package cloudwatch

import (
	"context"
	"testing"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	. "github.com/smartystreets/goconvey/convey"
)

var counter = 1

type cloudWatchFakeClient struct {
}

func (client *cloudWatchFakeClient) GetMetricDataWithContext(ctx aws.Context, input *cloudwatch.GetMetricDataInput, opts ...request.Option) (*cloudwatch.GetMetricDataOutput, error) {
	nextToken := "next"
	res := []*cloudwatch.MetricDataResult{{
		Values: []*float64{aws.Float64(12.3), aws.Float64(23.5)},
	}}
	if counter == 0 {
		nextToken = ""
		res = []*cloudwatch.MetricDataResult{{
			Values: []*float64{aws.Float64(100)},
		}}
	}
	counter--
	return &cloudwatch.GetMetricDataOutput{
		MetricDataResults: res,
		NextToken:         aws.String(nextToken),
	}, nil
}

func TestGetMetricDataExecutorTest(t *testing.T) {
	Convey("TestGetMetricDataExecutorTest", t, func() {
		Convey("pagination works", func() {
			executor := &CloudWatchExecutor{}
			inputs := &cloudwatch.GetMetricDataInput{MetricDataQueries: []*cloudwatch.MetricDataQuery{}}
			res, err := executor.executeRequest(context.Background(), &cloudWatchFakeClient{}, inputs)
			So(err, ShouldBeNil)
			So(len(res), ShouldEqual, 2)
			So(len(res[0].MetricDataResults[0].Values), ShouldEqual, 2)
			So(*res[0].MetricDataResults[0].Values[1], ShouldEqual, 23.5)
			So(*res[1].MetricDataResults[0].Values[0], ShouldEqual, 100)
		})
	})

}
