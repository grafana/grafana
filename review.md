# Anonymous: Add configurable device limit

## 前提
- 自分のフロントエンドのキャリアの都合上Goに関しては、言語設計のざっくりな内容は理解しているものの、深い知識がないため深いレビューまでできません
- [Goのskills](https://github.com/samber/cc-skills-golang)と[GrafanaのSkills](https://github.com/grafana/skills)が提供されていたためそちらを使いました。

## 1. 問題点の一覧（箇所・内容・重大度を含む）

プロンプトの内容は以下です。

```
既にマージされていてる https://github.com/grafana/grafana/pull/79265　こちらのPRをまず確認してください
- このPRについてskillsの観点に加えて、このPRで行っていることが妥当か品質として問題ないかとA Philosophy of Software Designの観点で詳しくレビューしてください
- 観点、重要度（Aがクリティカル、Bはできれば修正、Cは問題ないが、気になる点）、重要度、該当箇所について最後に表として出力してください
```
返答としては以下になります。

```
  PR #79265: Anonymous: Add configurable device limit — 総合コードレビュー

  1. PR概要

  匿名デバイスの数に上限を設けるための設定可能なdevice limitを追加するPR。上限に達した場合、新しいデバイスの認証をブロックし、既存デバイスのみ更新を許可する。

  変更ファイル: 11ファイル (+105/-37)
  マージ日: 2023-12-12
  著者: @Jguer, @eleijonmarck

  ---
  2. Skills観点でのレビュー

  2.1 Error Handling (golang-error-handling skill)

  違反: Single Handling Rule (ログ AND リターン)

  impl.go のPR時点のコード:
  err = a.tagDeviceUI(ctx, httpReq, taggedDevice)
  if err != nil {
      a.log.Debug("Failed to tag device for UI", "error", err)
      return err  // ← ログ AND リターン
  }
  エラーをログに出力した上でリターンしている。スキルの原則 #7「Errors MUST be either logged OR returned, NEVER both」に違反。呼び出し元の client.go でもさらにログ出力やエラーハンドリングしているため、二重ログになる。

  問題: Sentinel error が fmt.Errorf で定義されている

  var ErrDeviceLimitReached = fmt.Errorf("device limit reached")
  Sentinel error は errors.New で定義すべき。fmt.Errorf は wrapping のための関数であり、ここでは不要。スキルの原則 #8 に沿うなら:
  var ErrDeviceLimitReached = errors.New("device limit reached")

  問題: エラーメッセージのコンテキスト不足

  updateDevice で rowsAffected == 0 の場合に ErrDeviceLimitReached を返すが、これは必ずしも「デバイスリミット到達」ではない。デバイスが期限外（30日超）の場合も RowsAffected == 0 になる。エラーの意味が正確でない。

  2.2 Concurrency (golang-concurrency skill)

  改善: goroutine の fire-and-forget パターンの除去

  PR前の client.go は:
  go func() {
      defer func() {
          if err := recover(); err != nil { ... }
      }()
      newCtx, cancel := context.WithTimeout(context.Background(), timeoutTag)
      defer cancel()
      if err := a.anonDeviceService.TagDevice(newCtx, httpReqCopy, anonymous.AnonDeviceUI); err != nil {
          a.log.Warn("Failed to tag anonymous session", "error", err)
      }
  }()

  これをPRで同期呼び出しに変更したのは正しい判断。スキルの原則 #1「Every goroutine must have a clear exit」と原則「don't add concurrency without measured need」に合致する。device limitのエラーを呼び出し元に伝播するには同期化が必須。

  ただし、パフォーマンスへの影響の考慮が不足。元々goroutineに逃がしていた理由は認証のレイテンシに影響を与えないため。同期化により、DBアクセス（COUNT + INSERT/UPDATE）が認証パスのクリティカルパスに入る。

  2.3 Database (golang-database skill)

  問題: Race Condition (TOCTOU)

  // CreateOrUpdateDevice
  if s.deviceLimit > 0 {
      count, err := s.CountDevices(ctx, ...)
      if count >= s.deviceLimit {
          return s.updateDevice(ctx, device)
      }
  }
  // ← ここで別リクエストがINSERTする可能性
  // UPSERTが実行される

  CountDevices と CreateOrUpdateDevice の間にトランザクションがなく、TOCTOU (Time-of-Check-to-Time-of-Use) の競合状態がある。高トラフィック環境では、カウントチェック後〜UPSERT実行前の間に他リクエストがデバイスを追加でき、実際のデバイス数がlimitを超える可能性がある。

  スキルの原則「Use transactions for multi-statement operations」に違反。

  問題: 生SQL + interface{} の使用

  args := []interface{}{device.ClientIP, device.UserAgent, ...}
  // ...
  args = append([]interface{}{query}, args...)
  result, err := dbSession.Exec(args...)

  interface{} (Go 1.18以降は any) の使い方が古い。また、updateDevice メソッドでDB方言(MySQL/PostgreSQL/SQLite)の考慮がない。BETWEEN は全方言で動くが、CreateOrUpdateDevice は方言分岐しているのに updateDevice はしていない不整合がある。

  2.4 Security (golang-security skill)

  リスク: DoS ベクトル

  同期化によって、CountDevices のDBクエリが全認証リクエストのクリティカルパスに入った。匿名リクエストを大量に送るだけでDBに負荷がかかるため、レートリミットがなければDoSベクトルになりうる。DREAD: Medium (4-5)。

  考慮点: device_limit=0 のデフォルト動作

  cfg.AnonymousDeviceLimit = anonSection.Key("device_limit").MustInt64(0)

  0 がデフォルトで「制限なし」を意味する。負の値が設定された場合の挙動が未定義。-1 なら s.deviceLimit > 0 が false になり制限なしと同じ。明示的なバリデーションが望ましい。

  2.5 Testing (golang-testing skill)

  問題: テストケースが不十分

  TestIntegrationBeyondDeviceLimit は1つのシナリオしかテストしていない:
  - limit=1 で2台目のデバイスがブロックされる

  テストすべきだが欠けているケース:
  1. limit=0 で制限なし — 実際に無制限動作するか
  2. 既存デバイスの更新がlimit到達後も成功するか — updateDevice のハッピーパス
  3. 同時リクエストでの競合 — race condition の検出
  4. limit境界値 — ちょうどlimitのとき新規作成できるか (limit=N で N台目)
  5. 期限切れデバイスがカウントから除外されるか

  スキルの原則「test observable behavior」「table-driven tests MUST use named subtests」に照らすと、テーブル駆動テストで複数シナリオを網羅すべき。

  ---
  3. A Philosophy of Software Design の観点

  3.1 Complexity: 不要な複雑性の導入

  John Ousterhout の定義では、複雑性は「システムを理解しにくく、変更しにくくするもの」。このPRにはいくつかの cognitive load の増大がある:

  同一定数の重複定義

  // anonstore/database.go
  const anonymousDeviceExpiration = 30 * 24 * time.Hour

  // api/api.go
  const anonymousDeviceExpiration = 30 * 24 * time.Hour

  同じ値・同じ名前の定数が2箇所に定義されている。将来片方だけ変更されると不整合が生まれる。これは Unknown unknowns の典型で、開発者が片方の存在を知らない限りバグを埋め込む。

  3.2 Deep Module vs Shallow Module

  updateDevice メソッドは shallow module (浅いモジュール) の傾向がある:

  - インターフェースの複雑さ (何をするか理解するための認知コスト) に対して、提供する機能が限定的
  - CreateOrUpdateDevice から呼ばれるだけの単一用途
  - 内部ロジック（BETWEEN条件での更新、RowsAffected=0でlimit reached判定）が呼び出し側の知識を前提としている

  Ousterhout は「モジュールは深くあるべき — シンプルなインターフェースの裏に多くの機能を隠す」と述べている。updateDevice は逆に、内部の仕組みを理解しないと使い方が分からない。

  3.3 Error Concealment (エラーの隠蔽)

  updateDevice で RowsAffected == 0 → ErrDeviceLimitReached としているが、実際には 「該当デバイスが存在しないか期限切れ」 が正確な意味。これは Ousterhout が言う "Define errors out of existence" の逆パターン — エラーの意味を曖昧にしている。

  本当は2つの異なるケースがある:
  1. デバイスがlimit超過で作成できない（正当なlimit到達）
  2. デバイスが存在しない or 期限切れで更新できなかった（異なるエラー条件）

  3.4 Strategic vs Tactical Programming

  このPRは tactical programming (戦術的プログラミング) の傾向が見られる。Ousterhout が警告する「とりあえず動くものを作る」アプローチ:

  - トランザクション分離なしのcount→upsertは「今動く」が正確性を保証しない
  - anonymousDeviceExpiration の重複は「今は同じ値だから問題ない」
  - ProvideAnonDBStore のシグネチャ変更（anonStore → sqlStore + deviceLimit）でDI層が変わるが、Wire再生成の影響範囲が考慮されていない

  Strategic programming なら、device limit のロジックを独立したミドルウェアまたはデコレータとして設計し、AnonStore 自体は純粋なCRUD責務に留めるべき。

  3.5 Information Leakage (情報の漏洩)

  AnonDBStore が deviceLimit を保持しているのは、ストレージ層にビジネスロジック（制限判定）が漏洩している。Ousterhout の "Information leakage between modules" に該当:

  - AnonDBStore はデータアクセスの責務
  - device limitの判定はビジネスロジックの責務
  - これらが1つの構造体に混在している

  理想的には:
  // Store層: 純粋なCRUD
  type AnonDBStore struct { sqlStore db.DB; log log.Logger }

  // Service層: ビジネスロジック (limitの判定)
  type AnonDeviceService struct { store AnonStore; deviceLimit int64; ... }

  ---

```

# | 観点 | 重要度 | 説明 | 該当箇所 |
  |---|------|--------|------|----------|
  | 1 | **TOCTOU Race Condition** | **A** | `CountDevices` と UPSERT の間にトランザクションがなく、高トラフィック時に device limit を超過しうる | `pkg/services/anonymous/anonimpl/anonstore/database.go` `CreateOrUpdateDevice` (L133-146) |
  | 2 | **updateDevice の RowsAffected==0 の意味の不一致** | **A** | デバイスが存在しない/期限切れの場合も `ErrDeviceLimitReached` を返す。誤ったエラーで認証がブロックされる可能性 | `pkg/services/anonymous/anonimpl/anonstore/database.go` `updateDevice` (L101-131) |
  | 3 | **同期化によるDoSリスク** | **B** | DB COUNT クエリが認証のクリティカルパスに入り、大量匿名リクエストでDB負荷増大。レートリミットなし | `pkg/services/anonymous/anonimpl/client.go` `Authenticate` (L55-61) |
  | 4 | **Single Handling Rule 違反 (ログ AND リターン)** | **B** | `tagDeviceUI` のエラーをログ出力した上で return している。呼び出し元 `client.go` でも再度ハンドリングされ二重ログになる | `pkg/services/anonymous/anonimpl/impl.go` `TagDevice` (L163-168) |
  | 5 | **ストレージ層へのビジネスロジック漏洩** | **B** | `AnonDBStore` が `deviceLimit` を保持し、limit判定をストア内で行っている。CRUD責務とビジネスロジック責務の混在 | `pkg/services/anonymous/anonimpl/anonstore/database.go` `AnonDBStore` struct (L22-26) / `CreateOrUpdateDevice` (L133-146) |
  | 6 | **テストケース不足** | **B** | limit=0で無制限、既存デバイス更新成功、limit境界値、期限切れデバイスの除外、並行リクエスト競合のテストが欠如 | `pkg/services/anonymous/anonimpl/anonstore/database_test.go` `TestIntegrationBeyondDeviceLimit` (L51-68) |
  | 7 | **anonymousDeviceExpiration 定数の重複定義** | **B** | 同じ値・同じ名前の定数が2ファイルに存在。片方だけ変更される unknown unknowns リスク | `pkg/services/anonymous/anonimpl/anonstore/database.go` L17 / `pkg/services/anonymous/anonimpl/api/api.go` L17 |
  | 8 | **Sentinel error が `fmt.Errorf` で定義** | **C** | `fmt.Errorf` は wrapping 用。sentinel error には `errors.New` が慣用的 | `pkg/services/anonymous/anonimpl/anonstore/database.go` L20 |
  | 9 | **device_limit の入力バリデーション不足** | **C** | 負の値が設定された場合の挙動が未定義（`> 0` で弾かれるため実害は小さいが明示的バリデーションが望ましい） | `pkg/setting/setting.go` L1657 |
  | 10 | **updateDevice のDB方言未考慮** | **C** | `CreateOrUpdateDevice` は MySQL/PostgreSQL/SQLite で分岐しているのに `updateDevice` は分岐なし。現状は動くが設計の不整合 | `pkg/services/anonymous/anonimpl/anonstore/database.go` `updateDevice` (L101-131) |
  | 11 | **Shallow Module** | **C** | `updateDevice` は単一呼び出し元からのみ使用され、内部の BETWEEN 条件や RowsAffected 判定の意図が呼び出し側の文脈なしには理解困難 | `pkg/services/anonymous/anonimpl/anonstore/database.go` `updateDevice` (L101-131) |
  | 12 | **フロントエンド型定義の `undefined` デフォルト** | **C** | `anonymousDeviceLimit = undefined` は TypeScript 的に `number \| undefined` だが、明示的に `0` をデフォルトとし backend 側の「0=無制限」と揃える方が一貫性がある | `packages/grafana-runtime/src/config.ts` L97 |



## 2. 各問題点の修正提案（コード例があればなお良い）
- プロンプト結果の含まれています。


## 3. 使用したAIツール名となぜそのツールを利用したのか
- ClaudeCodeをCLIから使いました。
- 普段よく使うツールで慣れていたため。CLIから使えることで、使いやすくメリットも大きい（ClaudeCodeには拡張機能があるが、一部コマンドが使えなかったりするので）
- Codexは、普段の業務上ではClaudeCodeと併用して使っていますが、今回は、自分で契約していない会社資産のものなので利用を控えました

## 4. 「自分で気づいた問題」と「AIに指摘させた問題」の区分
- 自分で気づいた問題点としてはAIにプロンプトを渡す前にテストケースが全くないのが気になりました。
- 何故このような対応が必要なのか本質的な理由はPR上では、読み取れなかったので不明ですがパッとコードを見た時に暫定的な対応だなという印象を持ちました。
- AIにはとくにセキュリティの観点で深堀りしました。DBへの負荷やlimitを超えたときのエラーハンドリングなどはクリティカルな要素になりうるため
- セキュリティの観点は最初にレビューしてもらった内容からも重要度Aとして出力されています。
- AIに指摘された箇所についてとくにセキュリティの観点は、CWEを参照して調べ妥当な判断と考えました。
- エラーハンドリングなどはGoのブログを調べたりしました。（https://go.dev/blog/go1.13-errors）

## 5. このPRをマージしてよいかの判断とその理由

- 暫定的な対応だとしてもテストケースがないのでマージするのはあまり良い判断ではないと感じています。
- また最低限のコーディングのルールに逸脱している（Skillsに記載された内容）のでそちらも合わせて修正してからマージする必要があります。
