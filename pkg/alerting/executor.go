package alerting

import (
	"fmt"
	"net/http"

	"bosun.org/graphite"
)

func Executor() {
	// TODO: once i have my own linux dev machine i can easily run docker and will nice authenticated requests to configured source
	gr := graphite.HostHeader{
		//"play.grafana.org/api/datasources/proxy/1",
		"graphiteApi_1:8888",
		http.Header{
			"X-Org-Id": []string{"1"},
		}}

	for job := range queue {
		// note: if timestamp is very old, we still process. better to be backlogged then not do jobs, up to operator to make system keep up
		// if timestamp is in future, we still process and assume that whoever created the job knows what they are doing.
		// TODO: ignore jobs already processed
		evaluator, err := NewGraphiteCheckEvaluator(gr, job.Definition)
		if err != nil {
			// expressions should be validated before they are stored in the db
			// if they fail now it's a critical error
			panic(fmt.Sprintf("received invalid check definition '%s': %s", err))
		}

		res, err := evaluator.Eval(job.ts)
		fmt.Println(job, err, res)
	}
}
