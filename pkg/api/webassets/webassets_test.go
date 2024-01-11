package webassets

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestReadWebassets(t *testing.T) {
	assets, err := readWebAssetsFromFile("testdata/sample-assets-manifest.json")
	require.NoError(t, err)

	dto, err := json.MarshalIndent(assets, "", "  ")
	require.NoError(t, err)
	//fmt.Printf("%s\n", string(dto))

	require.JSONEq(t, `{
		"jsFiles": [
		  {
			"filePath": "public/build/runtime.20ed8c01880b812ed29f.js",
			"integrity": "sha256-rcdxIHk6cWgu4jiFa1a+pWlileYD/R72GaS8ZACBUdw= sha384-I/VJZQkt+TuJTvu61ihdWPds7EHfLrW5CxeQ0x9gtSqoPg9Z17Uawz1yoYaTdxqQ sha512-4CPAbh4KdTmGxHoQw4pgpYmgAquupVfwfo6UBV2cGU3vGFnEwkhq320037ETwWs+n9xB/bAMOvrdabp1SA1+8g=="
		  },
		  {
			"filePath": "public/build/3951.4e474348841d792ab1ba.js",
			"integrity": "sha256-dHqXXTRA3osYhHr9rol8hOV0nC4VP0pr5tbMp5VD95Q= sha384-4QJaSTibnxdYeYsLnmXtd1+If6IkAmXlLR0uYHN5+N+fS0FegHRH7MIFaRGjiO1B sha512-vRLEeEGbxBCx0z+l/m14fSK49reqWGA9zQzsCrD+TQQBmP07YIoRPwopMMyxtKljbbRFV0bW2bUZ7ZvzOZYoIQ=="
		  },
		  {
			"filePath": "public/build/3651.4e8f7603e9778e1e9b59.js",
			"integrity": "sha256-+N7caL91pVANd7C/aquAneRTjBQenCwaEKqj+3qkjxc= sha384-GQR7GyHPEwwEVph9gGYWEWvMYxkITwcOjieehbPidXZrybuQyw9cpDkjnWo1tj/w sha512-zyPM+8AxyLuECEXjb9w6Z2Sy8zmJdkfTWQphcvAb8AU4ZdkCqLmyjmOs/QQlpfKDe0wdOLyR3V9QgTDDlxtVlQ=="
		  },
		  {
			"filePath": "public/build/1272.8c79fc44bf7cd993c953.js",
			"integrity": "sha256-d7MRVimV83v4YQ5rdURfTaaFtiedXP3EMLT06gvvBuQ= sha384-8tRpYHQ+sEkZ8ptiIbKAbKPpHTJVnmaWDN56vJoWWUCzV1Q2w034wcJNKDJDJdAs sha512-cIZWoJHusF8qODBOj2j4b18ewcLLMo/92YQSwYQjln2G5e3o1bSO476ox2I2iecJ/tnhQK5j01h9BzTt3dNTrA=="
		  },
		  {
			"filePath": "public/build/6902.070074e8f5a989b8f4c3.js",
			"integrity": "sha256-TMo/uTZueyEHtkBzlLZzhwYKWF0epE4qbouo5xcwZkU= sha384-xylZJMtJ7+EsUBBdQZvPh+BeHJ3BnfclqI2vx/8QC9jvfYe/lhRsWW9OMJsxE/Aq sha512-EOmf+KZQMFPoTWAROL8bBLFfHhgvDH8ONycq37JaV7lz+sQOTaWBN2ZD0F/mMdOD5zueTg/Y1RAUP6apoEcHNQ=="
		  },
		  {
			"filePath": "public/build/app.0439db6f56ee4aa501b2.js",
			"integrity": "sha256-q6muaKY7BuN2Ff+00aw69628MXatcFnLNzWRnAD98DI= sha384-gv6lAbkngOHR05bvyOR8dm/J3wIjQQWSjyxK7W8vt2rG9uxcjvvDQV7aI6YbUhfX sha512-o/0mSlJ/OoqrpGdOIWCE3ZCe8n+qqLbgNCERtx9G8FIzsv++CvIWSGbbILjOTGfnEfEQWcKMH0macVpVBSe1Og=="
		  }
		],
		"dark": "public/build/grafana.dark.a28b24b45b2bbcc628cc.css",
		"light": "public/build/grafana.light.3572f6d5f8b7daa8d8d0.css"
	  }`, string(dto))

	assets.SetContentDeliveryURL("https://grafana-assets.grafana.net/grafana/10.3.0-64123/")

	dto, err = json.MarshalIndent(assets, "", "  ")
	require.NoError(t, err)
	//fmt.Printf("%s\n", string(dto))

	require.JSONEq(t, `{
		"cdn": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/",
		"jsFiles": [
		  {
			"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/runtime.20ed8c01880b812ed29f.js",
			"integrity": "sha256-rcdxIHk6cWgu4jiFa1a+pWlileYD/R72GaS8ZACBUdw= sha384-I/VJZQkt+TuJTvu61ihdWPds7EHfLrW5CxeQ0x9gtSqoPg9Z17Uawz1yoYaTdxqQ sha512-4CPAbh4KdTmGxHoQw4pgpYmgAquupVfwfo6UBV2cGU3vGFnEwkhq320037ETwWs+n9xB/bAMOvrdabp1SA1+8g=="
		  },
		  {
			"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/3951.4e474348841d792ab1ba.js",
			"integrity": "sha256-dHqXXTRA3osYhHr9rol8hOV0nC4VP0pr5tbMp5VD95Q= sha384-4QJaSTibnxdYeYsLnmXtd1+If6IkAmXlLR0uYHN5+N+fS0FegHRH7MIFaRGjiO1B sha512-vRLEeEGbxBCx0z+l/m14fSK49reqWGA9zQzsCrD+TQQBmP07YIoRPwopMMyxtKljbbRFV0bW2bUZ7ZvzOZYoIQ=="
		  },
		  {
			"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/3651.4e8f7603e9778e1e9b59.js",
			"integrity": "sha256-+N7caL91pVANd7C/aquAneRTjBQenCwaEKqj+3qkjxc= sha384-GQR7GyHPEwwEVph9gGYWEWvMYxkITwcOjieehbPidXZrybuQyw9cpDkjnWo1tj/w sha512-zyPM+8AxyLuECEXjb9w6Z2Sy8zmJdkfTWQphcvAb8AU4ZdkCqLmyjmOs/QQlpfKDe0wdOLyR3V9QgTDDlxtVlQ=="
		  },
		  {
			"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/1272.8c79fc44bf7cd993c953.js",
			"integrity": "sha256-d7MRVimV83v4YQ5rdURfTaaFtiedXP3EMLT06gvvBuQ= sha384-8tRpYHQ+sEkZ8ptiIbKAbKPpHTJVnmaWDN56vJoWWUCzV1Q2w034wcJNKDJDJdAs sha512-cIZWoJHusF8qODBOj2j4b18ewcLLMo/92YQSwYQjln2G5e3o1bSO476ox2I2iecJ/tnhQK5j01h9BzTt3dNTrA=="
		  },
		  {
			"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/6902.070074e8f5a989b8f4c3.js",
			"integrity": "sha256-TMo/uTZueyEHtkBzlLZzhwYKWF0epE4qbouo5xcwZkU= sha384-xylZJMtJ7+EsUBBdQZvPh+BeHJ3BnfclqI2vx/8QC9jvfYe/lhRsWW9OMJsxE/Aq sha512-EOmf+KZQMFPoTWAROL8bBLFfHhgvDH8ONycq37JaV7lz+sQOTaWBN2ZD0F/mMdOD5zueTg/Y1RAUP6apoEcHNQ=="
		  },
		  {
			"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/app.0439db6f56ee4aa501b2.js",
			"integrity": "sha256-q6muaKY7BuN2Ff+00aw69628MXatcFnLNzWRnAD98DI= sha384-gv6lAbkngOHR05bvyOR8dm/J3wIjQQWSjyxK7W8vt2rG9uxcjvvDQV7aI6YbUhfX sha512-o/0mSlJ/OoqrpGdOIWCE3ZCe8n+qqLbgNCERtx9G8FIzsv++CvIWSGbbILjOTGfnEfEQWcKMH0macVpVBSe1Og=="
		  }
		],
		"dark": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/grafana.dark.a28b24b45b2bbcc628cc.css",
		"light": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/grafana.light.3572f6d5f8b7daa8d8d0.css"
	  }`, string(dto))
}

func TestReadWebassetsFromCDN(t *testing.T) {
	t.Skip()

	assets, err := readWebAssetsFromCDN(context.Background(), "https://grafana-assets.grafana.net/grafana/10.3.0-64123/")
	require.NoError(t, err)

	dto, err := json.MarshalIndent(assets, "", "  ")
	require.NoError(t, err)
	//fmt.Printf("%s\n", string(dto))

	require.JSONEq(t, `{
		"cdn": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/",
		"jsFiles": [
		  {
			"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/runtime.6d702760ddd47772f116.js",
			"integrity": "sha256-6tSxwMwqd9McukcH+i56v1v+8JsVlMXPWKUCIK30yK8= sha384-dfRWJ5QfPAiQKJ9fUugmeXVdRSx8OS3XUdkEyEhxkm9CZQf9KeUyUe6fGV7VL7s9 sha512-0kjFCSBeQtdS3F9B/uqX45KMMUffYpsU7Ve7AYjy75HiBzovxRGG4hWPZD7d4Gha0Y3Oj4AmZA37TJoafptlRQ=="
		  },
		  {
			"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/7653.f5c70a70add3b711f560.js",
			"integrity": "sha256-p65DYfZPt9NU7vDwlxW+sY9sK+wQ9tJgTGlCJt+LvxY= sha384-P1TDQw3ZJ4X6Fiyn6UpLpVuHq+UW3zKRUM6U0vjucSl/bjFmQJfGR9XE64uEn6sJ sha512-sPqhDs/mWUBL6txtyoTdlgyZvVfdttUAXdV39aEroYpSnl/uEoLIcNBem5mNxoh4ut4TpSb9hlW6tTD7QV07/g=="
		  },
		  {
			"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/182.0b85a6da60c3ae0a9093.js",
			"integrity": "sha256-4vJBytomvJYkSsXlAo7BXDiXRsi5JVWBosIZSMCYlqs= sha384-MWfyWG85/+OvsA4E9CvG1NGiSzrp/EH37Xd/+qfdMFKmvAEGzGx9N/4xF+3N3/yj sha512-j1h6qobFAJYU+7QFdcChEeHa/FPXuArEsHJuXSYtaqrDU7oNHyW1PqFz6kNUwqE674Hutl93EeY+UsUlpZgZZQ=="
		  },
		  {
			"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/8781.91ede282a7f6078508e7.js",
			"integrity": "sha256-b68VAYMTugwWaHtffKI4qCMSWTN/fg0xQv+MnSILQgg= sha384-ptDkcAAAQhuG9Mhvs6gvGIp0HIjCfAP+ysaMltIr3L5alN6Ki71Si/zO6C70YArC sha512-N5tkcDgTPcNvQymegqnx0syp0kS7wVzPnt7i5KSu/RAi6cfM9XiRfz7bZh6fcZAJxApvpL1OJhUQQwPFFBN4ZA=="
		  },
		  {
			"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/3958.1d29ae9e8eb421432f48.js",
			"integrity": "sha256-9c+QGDOI8HtAzVBLA3nJOOU+LzhoENAhIEw7gGSkgWY= sha384-Y05zEdrM/ab9jzGH6segO9GyE8OTV5RvWPZFgynXX4XgvMOyWJcySqwW4RoIVo6P sha512-+ro4iXipgz1zUySd8oMbOY6XX+RjP4gi8bksFNjJGiLQOHVb/EKZKDj5UBeIE96XMd1AoEvZdymCvaft3d8oeA=="
		  },
		  {
			"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/app.18e8d3e07edcc1356a6a.js",
			"integrity": "sha256-ueeH8P/rDaft7jtzRmTN4UpNtiPfhzYa7c1VbBiRLTo= sha384-SijeOWlmIMzm/WNVg5e+yMieef6LOFXMu8d2laBtaY/2m/fviGI+8W55jazWzb+C sha512-qr5MoBZ4wNTCm6aRQ5/mglO8gShmKFpvr066SJgKyAJA4j8cK0snL2XhubUNxND+KkpKAnRe7EjsHYd28/uvkw=="
		  }
		],
		"dark": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/grafana.dark.b44253d019cd9cb46428.css",
		"light": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/grafana.light.e8e11c59b604d62836be.css"
	  }`, string(dto))
}
