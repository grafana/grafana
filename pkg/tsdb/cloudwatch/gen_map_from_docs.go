package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"sort"
	"strings"

	"github.com/grafana/grafana/1/blackfriday"
)

func removeDuplicates(e []string) []string {
	result := []string{}

	found := map[string]bool{}
	for v := range e {
		if !found[e[v]] {
			found[e[v]] = true
			result = append(result, e[v])
		}
	}
	return result
}

func main() {
	md, err := ioutil.ReadFile(os.Args[1])
	if err != nil {
		panic(err)
	}

	md = bytes.Replace(md, []byte(" \n"), []byte("\n"), -1)
	parser := blackfriday.New(blackfriday.WithExtensions(blackfriday.CommonExtensions))
	ast := parser.Parse(md)

	result := make(map[string]map[string][]string)
	namespace := ""

	namespaceMap := map[string]string{
		"connect-metricscollected.md":         "AWS/Connect",
		"dms-metricscollected.md":             "AWS/DMS",
		"dx-metricscollected.md":              "AWS/DX",
		"dynamo-metricscollected.md":          "AWS/DynamoDB",
		"ebs-metricscollected.md":             "AWS/EBS",
		"elasticache-metricscollected.md":     "AWS/ElastiCache",
		"inspector-metricscollected.md":       "AWS/Inspector",
		"iot-metricscollected.md":             "AWS/IoT",
		"ita-metricscollected.md":             "",
		"lex-metricscollected.md":             "AWS/Lex",
		"nat-gateway-metricscollected.md":     "AWS/NATGateway",
		"ops-metricscollected.md":             "AWS/OpsWorks",
		"polly-metricscollected.md":           "AWS/Polly",
		"ses-metricscollected.md":             "AWS/SES",
		"shield-advanced-metricscollected.md": "AWS/DDoSProtection",
		"translate-metricscollected.md":       "AWS/Translate",
		"vpn-metricscollected.md":             "AWS/VPN",
	}
	for k, v := range namespaceMap {
		if strings.Index(os.Args[1], k) >= 0 {
			namespace = v
		}
	}

	ast.Walk(func(node *blackfriday.Node, entering bool) blackfriday.WalkStatus {
		if strings.Index(string(node.Literal), "namespace includes") >= 0 {
			if node.Prev.Type == blackfriday.Code {
				var buf []byte
				node.Prev.Walk(func(node *blackfriday.Node, entering bool) blackfriday.WalkStatus {
					buf = append(buf, node.Literal...)
					return blackfriday.GoToNext
				})
				namespace = string(buf)
			}
			return blackfriday.SkipChildren
		}

		if node.Type == blackfriday.Table {
			foundType := ""
			metrics := []string{}
			dimensions := []string{}

			t := node.FirstChild
			if t.Type == blackfriday.TableHead {
				for r := t.FirstChild; r != nil; r = r.Next {
					var buf []byte
					r.FirstChild.Walk(func(node *blackfriday.Node, entering bool) blackfriday.WalkStatus {
						buf = append(buf, node.Literal...)
						return blackfriday.GoToNext
					})
					if string(buf) == "Metric" {
						foundType = "metric"
						break
					}
					if string(buf) == "Dimension" || string(buf) == "Dimensions" {
						foundType = "dimension"
						break
					}
				}
			}

			if foundType == "" {
				return blackfriday.SkipChildren
			}

			t = node.FirstChild.Next
			if t.Type == blackfriday.TableBody {
				for r := t.FirstChild; r != nil; r = r.Next {
					var buf []byte
					r.FirstChild.Walk(func(node *blackfriday.Node, entering bool) blackfriday.WalkStatus {
						buf = append(buf, node.Literal...)
						return blackfriday.GoToNext
					})
					if foundType == "metric" {
						metrics = append(metrics, strings.Split(string(buf), ", ")...)
					} else if foundType == "dimension" {
						dimensions = append(dimensions, strings.Split(string(buf), ", ")...)
					}
				}
			}

			if len(metrics) > 0 || len(dimensions) > 0 {
				if _, ok := result[namespace]; !ok {
					result[namespace] = make(map[string][]string)
				}
				result[namespace]["metrics"] = append(result[namespace]["metrics"], metrics...)
				result[namespace]["dimensions"] = append(result[namespace]["dimensions"], dimensions...)
			}
			return blackfriday.SkipChildren
		}
		return blackfriday.GoToNext
	})

	for _, m := range result {
		sort.Strings(m["metrics"])
		sort.Strings(m["dimensions"])
		m["metrics"] = removeDuplicates(m["metrics"])
		m["dimensions"] = removeDuplicates(m["dimensions"])
	}

	resultJson, err := json.Marshal(result)
	if err != nil {
		panic(err)
	}
	if namespace != "" {
		fmt.Printf("%+v\n", string(resultJson))
	}
}
