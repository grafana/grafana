package pipeline

import (
	"bytes"
	"encoding/json"
	"log"
	"math/rand"
	"net/http"
	"os"
	"time"
)

type Data struct {
	Value1     float64                `json:"value1"`
	Value2     float64                `json:"value2"`
	Value3     *float64               `json:"value3"`
	Value4     float64                `json:"value4"`
	Annotation string                 `json:"annotation"`
	Array      []float64              `json:"array"`
	Map        map[string]interface{} `json:"map"`
	Host       string                 `json:"host"`
	Status     string                 `json:"status"`
}

// TODO: temporary for development, remove.
func postTestData() {
	i := 0
	for {
		time.Sleep(1000 * time.Millisecond)
		num1 := rand.Intn(10)
		num2 := rand.Intn(10)
		d := Data{
			Value1:     float64(num1),
			Value2:     float64(num2),
			Value4:     float64(i % 10),
			Annotation: "odd",
			Array:      []float64{float64(rand.Intn(10)), float64(rand.Intn(10))},
			Map: map[string]interface{}{
				"red":    1,
				"yellow": 4,
				"green":  7,
			},
			Host:   "macbook-local",
			Status: "running",
		}
		if i%2 != 0 {
			val := 4.0
			d.Value3 = &val
		}
		if i%2 == 0 {
			val := 3.0
			d.Value3 = &val
			d.Annotation = "even"
		}
		if i%10 == 0 {
			d.Value3 = nil
		}
		data, _ := json.Marshal(d)
		log.Println(string(data))
		req, _ := http.NewRequest("POST", "http://localhost:3000/api/live/push/json/auto", bytes.NewReader(data))
		req.Header.Set("Authorization", "Bearer "+os.Getenv("GF_TOKEN"))
		_, err := http.DefaultClient.Do(req)
		if err != nil {
			log.Fatal(err)
		}
		req, _ = http.NewRequest("POST", "http://localhost:3000/api/live/push/json/tip", bytes.NewReader(data))
		req.Header.Set("Authorization", "Bearer "+os.Getenv("GF_TOKEN"))
		_, err = http.DefaultClient.Do(req)
		if err != nil {
			log.Fatal(err)
		}
		req, _ = http.NewRequest("POST", "http://localhost:3000/api/live/push/json/exact", bytes.NewReader(data))
		req.Header.Set("Authorization", "Bearer "+os.Getenv("GF_TOKEN"))
		_, err = http.DefaultClient.Do(req)
		if err != nil {
			log.Fatal(err)
		}
		i++
	}
}
