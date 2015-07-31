package elastic

import (
	"encoding/json"
	"testing"
)

func TestReindexer(t *testing.T) {

	client := setupTestClientAndCreateIndexAndAddDocs(t)

	sourceCount, err := client.Count(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}
	if sourceCount <= 0 {
		t.Fatalf("expected more than %d documents; got: %d", 0, sourceCount)
	}

	targetCount, err := client.Count(testIndexName2).Do()
	if err != nil {
		t.Fatal(err)
	}
	if targetCount != 0 {
		t.Fatalf("expected %d documents; got: %d", 0, targetCount)
	}

	r := NewReindexer(client, testIndexName, CopyToTargetIndex(testIndexName2))
	ret, err := r.Do()
	if err != nil {
		t.Fatal(err)
	}
	if ret == nil {
		t.Fatalf("expected result != %v; got: %v", nil, ret)
	}
	if ret.Success != sourceCount {
		t.Errorf("expected success = %d; got: %d", sourceCount, ret.Success)
	}
	if ret.Failed != 0 {
		t.Errorf("expected failed = %d; got: %d", 0, ret.Failed)
	}
	if len(ret.Errors) != 0 {
		t.Errorf("expected to return no errors by default; got: %v", ret.Errors)
	}

	if _, err := client.Flush().Index(testIndexName2).Do(); err != nil {
		t.Fatal(err)
	}

	targetCount, err = client.Count(testIndexName2).Do()
	if err != nil {
		t.Fatal(err)
	}
	if targetCount != sourceCount {
		t.Fatalf("expected %d documents; got: %d", sourceCount, targetCount)
	}
}

func TestReindexerWithQuery(t *testing.T) {
	client := setupTestClientAndCreateIndexAndAddDocs(t)

	q := NewTermQuery("user", "olivere")

	sourceCount, err := client.Count(testIndexName).Query(q).Do()
	if err != nil {
		t.Fatal(err)
	}
	if sourceCount <= 0 {
		t.Fatalf("expected more than %d documents; got: %d", 0, sourceCount)
	}

	targetCount, err := client.Count(testIndexName2).Do()
	if err != nil {
		t.Fatal(err)
	}
	if targetCount != 0 {
		t.Fatalf("expected %d documents; got: %d", 0, targetCount)
	}

	r := NewReindexer(client, testIndexName, CopyToTargetIndex(testIndexName2))
	r = r.Query(q)
	ret, err := r.Do()
	if err != nil {
		t.Fatal(err)
	}
	if ret == nil {
		t.Fatalf("expected result != %v; got: %v", nil, ret)
	}
	if ret.Success != sourceCount {
		t.Errorf("expected success = %d; got: %d", sourceCount, ret.Success)
	}
	if ret.Failed != 0 {
		t.Errorf("expected failed = %d; got: %d", 0, ret.Failed)
	}
	if len(ret.Errors) != 0 {
		t.Errorf("expected to return no errors by default; got: %v", ret.Errors)
	}

	if _, err := client.Flush().Index(testIndexName2).Do(); err != nil {
		t.Fatal(err)
	}

	targetCount, err = client.Count(testIndexName2).Do()
	if err != nil {
		t.Fatal(err)
	}
	if targetCount != sourceCount {
		t.Fatalf("expected %d documents; got: %d", sourceCount, targetCount)
	}
}

func TestReindexerProgress(t *testing.T) {
	client := setupTestClientAndCreateIndexAndAddDocs(t)

	sourceCount, err := client.Count(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}
	if sourceCount <= 0 {
		t.Fatalf("expected more than %d documents; got: %d", 0, sourceCount)
	}

	var calls int64
	totalsOk := true
	progress := func(current, total int64) {
		calls += 1
		totalsOk = totalsOk && total == sourceCount
	}

	r := NewReindexer(client, testIndexName, CopyToTargetIndex(testIndexName2))
	r = r.Progress(progress)
	ret, err := r.Do()
	if err != nil {
		t.Fatal(err)
	}
	if ret == nil {
		t.Fatalf("expected result != %v; got: %v", nil, ret)
	}
	if ret.Success != sourceCount {
		t.Errorf("expected success = %d; got: %d", sourceCount, ret.Success)
	}
	if ret.Failed != 0 {
		t.Errorf("expected failed = %d; got: %d", 0, ret.Failed)
	}
	if len(ret.Errors) != 0 {
		t.Errorf("expected to return no errors by default; got: %v", ret.Errors)
	}

	if calls != sourceCount {
		t.Errorf("expected progress to be called %d times; got: %d", sourceCount, calls)
	}
	if !totalsOk {
		t.Errorf("expected totals in progress to be %d", sourceCount)
	}
}

func TestReindexerWithTargetClient(t *testing.T) {
	sourceClient := setupTestClientAndCreateIndexAndAddDocs(t)
	targetClient, err := NewClient()
	if err != nil {
		t.Fatal(err)
	}

	sourceCount, err := sourceClient.Count(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}
	if sourceCount <= 0 {
		t.Fatalf("expected more than %d documents; got: %d", 0, sourceCount)
	}

	targetCount, err := targetClient.Count(testIndexName2).Do()
	if err != nil {
		t.Fatal(err)
	}
	if targetCount != 0 {
		t.Fatalf("expected %d documents; got: %d", 0, targetCount)
	}

	r := NewReindexer(sourceClient, testIndexName, CopyToTargetIndex(testIndexName2))
	r = r.TargetClient(targetClient)
	ret, err := r.Do()
	if err != nil {
		t.Fatal(err)
	}
	if ret == nil {
		t.Fatalf("expected result != %v; got: %v", nil, ret)
	}
	if ret.Success != sourceCount {
		t.Errorf("expected success = %d; got: %d", sourceCount, ret.Success)
	}
	if ret.Failed != 0 {
		t.Errorf("expected failed = %d; got: %d", 0, ret.Failed)
	}
	if len(ret.Errors) != 0 {
		t.Errorf("expected to return no errors by default; got: %v", ret.Errors)
	}

	if _, err := targetClient.Flush().Index(testIndexName2).Do(); err != nil {
		t.Fatal(err)
	}

	targetCount, err = targetClient.Count(testIndexName2).Do()
	if err != nil {
		t.Fatal(err)
	}
	if targetCount != sourceCount {
		t.Fatalf("expected %d documents; got: %d", sourceCount, targetCount)
	}
}

// TestReindexerPreservingTTL shows how a caller can take control of the
// copying process by providing ScanFields and a custom ReindexerFunc.
func TestReindexerPreservingTTL(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tweet1 := tweet{User: "olivere", Message: "Welcome to Golang and Elasticsearch."}

	_, err := client.Index().Index(testIndexName).Type("tweet").Id("1").TTL("999999").Version(10).VersionType("external").BodyJson(&tweet1).Do()
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Flush().Index(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}

	sourceCount, err := client.Count(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}
	if sourceCount <= 0 {
		t.Fatalf("expected more than %d documents; got: %d", 0, sourceCount)
	}

	targetCount, err := client.Count(testIndexName2).Do()
	if err != nil {
		t.Fatal(err)
	}
	if targetCount != 0 {
		t.Fatalf("expected %d documents; got: %d", 0, targetCount)
	}

	// Carries over the source item's ttl to the reindexed item
	copyWithTTL := func(hit *SearchHit, bulkService *BulkService) error {
		source := make(map[string]interface{})
		if err := json.Unmarshal(*hit.Source, &source); err != nil {
			return err
		}
		req := NewBulkIndexRequest().Index(testIndexName2).Type(hit.Type).Id(hit.Id).Doc(source)
		if ttl, ok := hit.Fields["_ttl"].(float64); ok {
			req.Ttl(int64(ttl))
		}
		bulkService.Add(req)
		return nil
	}

	r := NewReindexer(client, testIndexName, copyWithTTL).ScanFields("_source", "_ttl")

	ret, err := r.Do()
	if err != nil {
		t.Fatal(err)
	}
	if ret == nil {
		t.Fatalf("expected result != %v; got: %v", nil, ret)
	}
	if ret.Success != sourceCount {
		t.Errorf("expected success = %d; got: %d", sourceCount, ret.Success)
	}
	if ret.Failed != 0 {
		t.Errorf("expected failed = %d; got: %d", 0, ret.Failed)
	}
	if len(ret.Errors) != 0 {
		t.Errorf("expected to return no errors by default; got: %v", ret.Errors)
	}

	getResult, err := client.Get().Index(testIndexName2).Id("1").Fields("_source", "_ttl").Do()
	if err != nil {
		t.Fatal(err)
	}

	_, ok := getResult.Fields["_ttl"].(float64)
	if !ok {
		t.Errorf("Cannot retrieve TTL from reindexed document")
	}

}
