package mqe

import (
	"encoding/json"
	"io/ioutil"
	"net/http"
	"strconv"
	"strings"

	"fmt"

	"regexp"

	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/tsdb"
)

func NewResponseParser() *ResponseParser {
	return &ResponseParser{
		log: log.New("tsdb.mqe"),
	}
}

var (
	indexAliasPattern    *regexp.Regexp
	wildcardAliasPattern *regexp.Regexp
)

func init() {
	indexAliasPattern = regexp.MustCompile(`\$(\d)`)
	wildcardAliasPattern = regexp.MustCompile(`[*!]`)
}

type MQEResponse struct {
	Success bool               `json:"success"`
	Name    string             `json:"name"`
	Body    []MQEResponseSerie `json:"body"`
}

type ResponseTimeRange struct {
	Start      int64 `json:"start"`
	End        int64 `json:"end"`
	Resolution int64 `json:"Resolution"`
}

type MQEResponseSerie struct {
	Query     string            `json:"query"`
	Name      string            `json:"name"`
	Type      string            `json:"type"`
	Series    []MQESerie        `json:"series"`
	TimeRange ResponseTimeRange `json:"timerange"`
}

type MQESerie struct {
	Values []null.Float      `json:"values"`
	Tagset map[string]string `json:"tagset"`
}

type ResponseParser struct {
	log log.Logger
}

func (parser *ResponseParser) Parse(res *http.Response, queryRef QueryToSend) ([]*tsdb.TimeSeries, error) {
	body, err := ioutil.ReadAll(res.Body)
	defer res.Body.Close()
	if err != nil {
		return nil, err
	}

	if res.StatusCode/100 != 2 {
		parser.log.Error("Request failed", "status code", res.StatusCode, "body", string(body))
		return nil, fmt.Errorf("Returned invalid statuscode")
	}

	var data *MQEResponse = &MQEResponse{}
	err = json.Unmarshal(body, data)
	if err != nil {
		parser.log.Info("Failed to unmarshal response", "error", err, "status", res.Status, "body", string(body))
		return nil, err
	}

	if !data.Success {
		return nil, fmt.Errorf("Request failed.")
	}

	var series []*tsdb.TimeSeries
	for _, body := range data.Body {
		for _, mqeSerie := range body.Series {
			serie := &tsdb.TimeSeries{
				Tags: map[string]string{},
				Name: parser.formatLegend(body, mqeSerie, queryRef),
			}
			for key, value := range mqeSerie.Tagset {
				serie.Tags[key] = value
			}

			for i, value := range mqeSerie.Values {
				timestamp := body.TimeRange.Start + int64(i)*body.TimeRange.Resolution
				serie.Points = append(serie.Points, tsdb.NewTimePoint(value, float64(timestamp)))
			}

			series = append(series, serie)
		}
	}

	return series, nil
}

func (parser *ResponseParser) formatLegend(body MQEResponseSerie, mqeSerie MQESerie, queryToSend QueryToSend) string {
	namePrefix := ""

	//append predefined tags to seriename
	for key, value := range mqeSerie.Tagset {
		if key == "cluster" && queryToSend.QueryRef.AddClusterToAlias {
			namePrefix += value + " "
		}
	}
	for key, value := range mqeSerie.Tagset {
		if key == "host" && queryToSend.QueryRef.AddHostToAlias {
			namePrefix += value + " "
		}
	}

	return namePrefix + parser.formatName(body, queryToSend)
}

func (parser *ResponseParser) formatName(body MQEResponseSerie, queryToSend QueryToSend) string {
	if indexAliasPattern.MatchString(queryToSend.Metric.Alias) {
		return parser.indexAlias(body, queryToSend)
	}

	if wildcardAliasPattern.MatchString(queryToSend.Metric.Metric) && wildcardAliasPattern.MatchString(queryToSend.Metric.Alias) {
		return parser.wildcardAlias(body, queryToSend)
	}

	return body.Name
}

func (parser *ResponseParser) wildcardAlias(body MQEResponseSerie, queryToSend QueryToSend) string {
	regString := strings.Replace(queryToSend.Metric.Metric, `*`, `(.*)`, 1)
	reg, err := regexp.Compile(regString)
	if err != nil {
		return queryToSend.Metric.Alias
	}

	matches := reg.FindAllStringSubmatch(queryToSend.RawQuery, -1)

	if len(matches) == 0 || len(matches[0]) < 2 {
		return queryToSend.Metric.Alias
	}

	return matches[0][1]
}

func (parser *ResponseParser) indexAlias(body MQEResponseSerie, queryToSend QueryToSend) string {
	queryNameParts := strings.Split(queryToSend.Metric.Metric, `.`)

	name := indexAliasPattern.ReplaceAllStringFunc(queryToSend.Metric.Alias, func(in string) string {
		positionName := strings.TrimSpace(strings.Replace(in, "$", "", 1))

		pos, err := strconv.Atoi(positionName)
		if err != nil {
			return ""
		}

		for i, part := range queryNameParts {
			if i == pos-1 {
				return strings.TrimSpace(part)
			}
		}

		return ""
	})

	return strings.Replace(name, " ", ".", -1)
}
