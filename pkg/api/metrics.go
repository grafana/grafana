package api

import (
	"github.com/Cepave/grafana/pkg/api/dtos"
	"github.com/Cepave/grafana/pkg/middleware"
	"math/rand"
	"strconv"
)

func GetTestMetrics(c *middleware.Context) {
	from := c.QueryInt64("from")
	to := c.QueryInt64("to")
	maxDataPoints := c.QueryInt64("maxDataPoints")
	stepInSeconds := (to - from) / maxDataPoints

	result := dtos.MetricQueryResultDto{}
	result.Data = make([]dtos.MetricQueryResultDataDto, 1)

	for seriesIndex := range result.Data {
		points := make([][2]float64, maxDataPoints)
		walker := rand.Float64() * 100
		time := from

		for i := range points {
			points[i][0] = walker
			points[i][1] = float64(time)
			walker += rand.Float64() - 0.5
			time += stepInSeconds
		}

		result.Data[seriesIndex].Target = "test-series-" + strconv.Itoa(seriesIndex)
		result.Data[seriesIndex].DataPoints = points
	}

	c.JSON(200, &result)
}
