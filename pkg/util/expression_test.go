package util

import (
	"fmt"
	"strings"
	"testing"
)

var label = "namespace"
var value = "tenant1"

var testExpr = []string {
	"absent(sum(nonexistent))",
	"absent(sum(go_memstats_alloc_bytes)/sum(go_memstats_stack_inuse_bytes)*100)",
	"sum(go_memstats_alloc_bytes)/sum(go_memstats_stack_inuse_bytes)*100",
	"nonexistent",
	"delta(cpu_temp_celsius{host=\"zeus\"}[2h])",
	"delta(cpu_temp_celsius[2h])",
	"method_code:http_errors:rate5m{code=\"500\"} / ignoring(code) method:http_requests:rate5m",
	"method_code:http_errors:rate5m / ignoring(code) group_left method:http_requests:rate5m",
	"http_requests_total offset 5m",
	"sum(http_requests_total{method=\"GET\"} offset 5m)",
	"(go_memstats_alloc_bytes+go_memstats_stack_inuse_bytes)*100",
	"cpu_temp_celsius",
	"cpu_temp_celsius{host=\"zeus\"}[2h]",
	"cpu_temp_celsius{namespace=\"tenant1\"}",
	"http_requests_total{app=\"cpro\"}[100m]" }

var expectExpr = []string {
	fmt.Sprintf("absent(sum(nonexistent{%s=\"%s\"}))", label, value),
	fmt.Sprintf("absent(sum(go_memstats_alloc_bytes{%s=\"%s\"})/sum(go_memstats_stack_inuse_bytes{%s=\"%s\"})*100)", label, value, label, value),
	fmt.Sprintf("sum(go_memstats_alloc_bytes{%s=\"%s\"})/sum(go_memstats_stack_inuse_bytes{%s=\"%s\"})*100",label, value, label, value),
	fmt.Sprintf("nonexistent{%s=\"%s\"}", label, value),
	fmt.Sprintf("delta(cpu_temp_celsius{host=\"zeus\",%s=\"%s\"}[2h])", label, value),
	fmt.Sprintf("delta(cpu_temp_celsius{%s=\"%s\"}[2h])", label, value),
	fmt.Sprintf("method_code:http_errors:rate5m{code=\"500\",%s=\"%s\"} / ignoring(code) method:http_requests:rate5m{%s=\"%s\"}", label, value, label, value),
	fmt.Sprintf("method_code:http_errors:rate5m{%s=\"%s\"} / ignoring(code) group_left() method:http_requests:rate5m{%s=\"%s\"}", label, value, label, value),
	fmt.Sprintf("http_requests_total{%s=\"%s\"} offset 5m", label, value),
	fmt.Sprintf("sum(http_requests_total{method=\"GET\",%s=\"%s\"} offset 5m)", label, value),
	fmt.Sprintf("(go_memstats_alloc_bytes{%s=\"%s\"}+go_memstats_stack_inuse_bytes{%s=\"%s\"})*100", label, value, label, value),
	fmt.Sprintf("cpu_temp_celsius{%s=\"%s\"}", label, value),
	fmt.Sprintf("cpu_temp_celsius{host=\"zeus\",%s=\"%s\"}[2h]", label, value),
	"cpu_temp_celsius{namespace=\"tenant1\"}",
	fmt.Sprintf("http_requests_total{app=\"cpro\",%s=\"%s\"}[100m]", label, value) }



func TestParseExpr(t *testing.T) {
	var index = 0
	for ; index < len(testExpr); index++ {
		newExpr := strings.Replace(ParseExpr(testExpr[index], label, value), " ", "", -1)
		expExpr := strings.Replace(expectExpr[index], " ", "", -1)
		if newExpr != expExpr {
			t.Errorf("Expected expr is '%s' but instead got '%s'", expExpr, newExpr)
		}
	}

}
