package influxdb

import "fmt"

type QueryBuild struct{}

func (*QueryBuild) Build(query *Query) (string, error) {

	return "", fmt.Errorf("query is not valid")
}
