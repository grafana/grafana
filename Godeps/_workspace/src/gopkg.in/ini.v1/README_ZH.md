本包提供了 Go 语言中读写 INI 文件的功能。

## 功能特性

- 支持覆盖加载多个数据源（`[]byte` 或文件）
- 支持递归读取键值
- 支持读取父子分区
- 支持读取自增键名
- 支持读取多行的键值
- 支持大量辅助方法
- 支持在读取时直接转换为 Go 语言类型
- 支持读取和 **写入** 分区和键的注释
- 轻松操作分区、键值和注释
- 在保存文件时分区和键值会保持原有的顺序

## 下载安装

    go get gopkg.in/ini.v1

## 开始使用

### 从数据源加载

一个 **数据源** 可以是 `[]byte` 类型的原始数据，或 `string` 类型的文件路径。您可以加载 **任意多个** 数据源。如果您传递其它类型的数据源，则会直接返回错误。

```go
cfg, err := ini.Load([]byte("raw data"), "filename")
```

当您在一开始无法决定需要加载哪些数据源时，仍可以使用 **Append()** 在需要的时候加载它们。

```go
err := cfg.Append("other file", []byte("other raw data"))
```

### 操作分区（Section）

获取指定分区：

```go
section, err := cfg.GetSection("section name")
```

如果您想要获取默认分区，则可以用空字符串代替分区名：

```go
section, err := cfg.GetSection("")
```

当您非常确定某个分区是存在的，可以使用以下简便方法：

```go
section := cfg.Section("")
```

如果不小心判断错了，要获取的分区其实是不存在的，那会发生什么呢？没事的，它会返回一个空的分区对象。

创建一个分区：

```go
err := cfg.NewSection("new section")
```

获取所有分区对象或名称：

```go
sections := cfg.Sections()
names := cfg.SectionStrings()
```

### 操作键（Key）

获取某个分区下的键：

```go
key, err := cfg.Section("").GetKey("key name")
```

和分区一样，您也可以直接获取键而忽略错误处理：

```go
key := cfg.Section("").Key("key name")
```

创建一个新的键：

```go
err := cfg.Section("").NewKey("name", "value")
```

获取分区下的所有键或键名：

```go
keys := cfg.Section().Keys()
names := cfg.Section().KeyStrings()
```

获取分区下的所有键值对的克隆：

```go
hash := cfg.GetSection("").KeysHash()
```

### 操作键值（Value）

获取一个类型为字符串（string）的值：

```go
val := cfg.Section("").Key("key name").String()
```

获取其它类型的值：

```go
v, err = cfg.Section("").Key("BOOL").Bool()
v, err = cfg.Section("").Key("FLOAT64").Float64()
v, err = cfg.Section("").Key("INT").Int()
v, err = cfg.Section("").Key("INT64").Int64()

v = cfg.Section("").Key("BOOL").MustBool()
v = cfg.Section("").Key("FLOAT64").MustFloat64()
v = cfg.Section("").Key("INT").MustInt()
v = cfg.Section("").Key("INT64").MustInt64()

// 由 Must 开头的方法名允许接收一个相同类型的参数来作为默认值，
// 当键不存在或者转换失败时，则会直接返回该默认值。
// 但是，MustString 方法必须传递一个默认值。

v = cfg.Seciont("").Key("String").MustString("default")
v = cfg.Section("").Key("BOOL").MustBool(true)
v = cfg.Section("").Key("FLOAT64").MustFloat64(1.25)
v = cfg.Section("").Key("INT").MustInt(10)
v = cfg.Section("").Key("INT64").MustInt64(99)
```

如果我的值有好多行怎么办？

```ini
[advance]
ADDRESS = """404 road,
NotFound, State, 5000
Earth"""
```

嗯哼？小 case！

```go
cfg.Section("advance").Key("ADDRESS").String()

/* --- start ---
404 road,
NotFound, State, 5000
Earth
------  end  --- */
```

这就是全部了？哈哈，当然不是。

#### 操作键值的辅助方法

获取键值时设定候选值：

```go
v = cfg.Section("").Key("STRING").In("default", []string{"str", "arr", "types"})
v = cfg.Section("").Key("FLOAT64").InFloat64(1.1, []float64{1.25, 2.5, 3.75})
v = cfg.Section("").Key("INT").InInt(5, []int{10, 20, 30})
v = cfg.Section("").Key("INT64").InInt64(10, []int64{10, 20, 30})
```

如果获取到的值不是候选值的任意一个，则会返回默认值，而默认值不需要是候选值中的一员。

自动分割键值为切片（slice）：

```go
vals = cfg.Section("").Key("STRINGS").Strings(",")
vals = cfg.Section("").Key("FLOAT64S").Float64s(",")
vals = cfg.Section("").Key("INTS").Ints(",")
vals = cfg.Section("").Key("INT64S").Int64s(",")
```

### 高级用法

#### 递归读取键值

在获取所有键值的过程中，特殊语法 `%(<name>)s` 会被应用，其中 `<name>` 可以是相同分区或者默认分区下的键名。字符串 `%(<name>)s` 会被相应的键值所替代，如果指定的键不存在，则会用空字符串替代。您可以最多使用 99 层的递归嵌套。

```ini
NAME = ini

[author]
NAME = Unknwon
GITHUB = https://github.com/%(NAME)s

[package]
FULL_NAME = github.com/go-ini/%(NAME)s
```

```go
cfg.Section("author").Key("GITHUB").String()		// https://github.com/Unknwon
cfg.Section("package").Key("FULL_NAME").String()	// github.com/go-ini/ini
```

#### 读取父子分区

您可以在分区名称中使用 `.` 来表示两个或多个分区之间的父子关系。如果某个键在子分区中不存在，则会去它的父分区中再次寻找，直到没有父分区为止。

```ini
NAME = ini
VERSION = v1
IMPORT_PATH = gopkg.in/%(NAME)s.%(VERSION)s

[package]
CLONE_URL = https://%(IMPORT_PATH)s

[package.sub]
```

```go
cfg.Section("package.sub").Key("CLONE_URL").String()	// https://gopkg.in/ini.v1
```

#### 读取自增键名

如果数据源中的键名为 `-`，则认为该键使用了自增键名的特殊语法。计数器从 1 开始，并且分区之间是相互独立的。

```ini
[features]
-: Support read/write comments of keys and sections
-: Support auto-increment of key names
-: Support load multiple files to overwrite key values
```

```go
cfg.Section("features").KeyStrings()	// []{"#1", "#2", "#3"}
```

## 获取帮助

- [API 文档](https://gowalker.org/gopkg.in/ini.v1)
- [创建工单](https://github.com/go-ini/ini/issues/new)

## 常见问题

### 字段 `BlockMode` 是什么？

默认情况下，本库会在您进行读写操作时采用锁机制来确保数据时间。但在某些情况下，您非常确定只进行读操作。此时，您可以通过设置 `cfg.BlockMode = false` 来将读操作提升大约 **50-70%** 的性能。

### 为什么要写另一个 INI 解析库？

许多人都在使用我的 [goconfig](https://github.com/Unknwon/goconfig) 来完成对 INI 文件的操作，但我希望使用更加 Go 风格的代码。并且当您设置 `cfg.BlockMode = false` 时，会有大约 **10-30%** 的性能提升。

为了做出这些改变，我必须对 API 进行破坏，所以新开一个仓库是最安全的做法。除此之外，本库直接使用 `gopkg.in` 来进行版本化发布。（其实真相是导入路径更短了）
