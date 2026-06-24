package webassets

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestReadWebassets(t *testing.T) {
	assets, err := ReadWebAssetsFromFile("testdata/build/assets-manifest.json")
	require.NoError(t, err)

	dto, err := json.MarshalIndent(assets, "", "  ")
	require.NoError(t, err)
	// fmt.Printf("%s\n", string(dto))

	require.JSONEq(t, `{
	"jsFiles": [
		{
		"filePath": "public/build/runtime.js",
		"integrity": "sha256-tM4AGASn3Cb8139+wp3w6rlo3ELFAuUW7K4Pifx226o= sha384-DfxxsYWb0+RxiXOr+wtCSzAAYGecffq/iHyn6CN9tHmaORv1sS+rsrnlnJo2jPQD sha512-qSxdqrx0mJLY1mdkbKrkCyqOoIEgFqzCoY9+uIuFRIVDPFbb2nJy0NtaKMQvDJnAzIrJFwzwW1e250T4WqQNiQ=="
		},
		{
		"filePath": "public/build/default-packages_grafana-ui_src_components_Layout_Stack_Stack_tsx-packages_grafana-ui_src_com-2a3620.js",
		"integrity": "sha256-+0bPuBGKFGglkXvW4oPiolrNveozRLZVLUrbCYsbVcM= sha384-EIayAgykdDWmyilAuXo4ad96v3tRqdWZp+BHdeDpSSsbAMeg+eoBBbk2Yh219kDg sha512-+jn7kmQ9Id8aTIe66TD+vM+W19cTIVexEfkxbxgqXdJyJ72qalN6ccWyP1ro1w/E1R/laZGNLz1LBc1I4u2Isw=="
		},
		{
		"filePath": "public/build/app.js",
		"integrity": "sha256-IOZKp3piC3vddDXP5jy5rIw0vb0KKEOg/k9EGrIxskk= sha384-CBNr5W0pJ23LQMnz5BZI1iVBIExOmF/wpqkEnBtYu9R/yYJIzjpv8KT0a3TBulOi sha512-ockzlzgosuZvLittZrSzh8lexEIZF9iKpy6J9Ii4es3e4D34FpWhHJhDZGpxLVraX4ypLofrDp2Yy0sdUbdi7w=="
		}
	],
	"cssFiles": [
		{
		"filePath": "public/build/grafana.app.91aaa9d81398c147a57c.css",
		"integrity": "sha256-77rfikk+dYkH82TOmcmleVoDOHZQdhzVX9gDLcgPbtQ= sha384-IOTlZ1IvTVq5ekKLoaE3/SoZ12K1eExOAnSw9BzkgQ3+RcyQpb1S5hO2w//IIkRB sha512-0Ct3uJBFQIkyxYTvMxseA1cphe2RivXQ2MCbiV0hEm5NzWPiY9sq2P4ay5dXz5v35c++4W47KaknoWlc83bQJQ=="
		}
	],
	"dark": "public/build/grafana.dark.722d809dba5a31f57d49.css",
	"light": "public/build/grafana.light.2fbd901d840329c18394.css",
	"swagger": [
		{
		"filePath": "public/build/runtime.js",
		"integrity": "sha256-tM4AGASn3Cb8139+wp3w6rlo3ELFAuUW7K4Pifx226o= sha384-DfxxsYWb0+RxiXOr+wtCSzAAYGecffq/iHyn6CN9tHmaORv1sS+rsrnlnJo2jPQD sha512-qSxdqrx0mJLY1mdkbKrkCyqOoIEgFqzCoY9+uIuFRIVDPFbb2nJy0NtaKMQvDJnAzIrJFwzwW1e250T4WqQNiQ=="
		},
		{
		"filePath": "public/build/swagger.js",
		"integrity": "sha256-wLlip7zRYODW/TPcI5JZPRdmWirc1KD+UcNF+8V9RBk= sha384-6VGD+LgCpjMZN/ORSjWcrWa9diUzQO3OfEhP0D2ZluSwP4IT+0kH7KEeD9NVbojd sha512-vZOCFzBZBhd34yGv8z7P4Gw4WLVR9HjpuK0y6Kcw+pCBk5Dv9qHBg3ZVs6s0tOnUmiMWwgL4Ne8f+zgiuJVPqg=="
		}
	],
	"swaggerCssFiles": [
		{
		"filePath": "public/build/grafana.swagger.2733d417270d5dd49373.css",
		"integrity": "sha256-GNcHNgIAT7S+J4X7seFjlvNPC1bRhM15d0cQBm3VFoQ= sha384-ywztCBf8uF0tTFjC1mLth33RI2WuFURN3dRy7Bv2PheGzbWJpwlgo9+mtT2Zm7mO sha512-e4c+VedZGqcwLqwfdqRWonggRPO0gjJ7Z0YbXK5z4bFTsUIc+x8ycIJG+eQaf8cuHlsakG4hkWNkRwLBazcFAg=="
		}
	]
	}`, string(dto))

	assets.SetContentDeliveryURL("https://grafana-assets.grafana.net/grafana/10.3.0-64123/")

	dto, err = json.MarshalIndent(assets, "", "  ")
	require.NoError(t, err)
	fmt.Printf("%s\n", string(dto))

	require.JSONEq(t, `{
	"cdn": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/",
	"jsFiles": [
		{
		"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/runtime.js",
		"integrity": "sha256-tM4AGASn3Cb8139+wp3w6rlo3ELFAuUW7K4Pifx226o= sha384-DfxxsYWb0+RxiXOr+wtCSzAAYGecffq/iHyn6CN9tHmaORv1sS+rsrnlnJo2jPQD sha512-qSxdqrx0mJLY1mdkbKrkCyqOoIEgFqzCoY9+uIuFRIVDPFbb2nJy0NtaKMQvDJnAzIrJFwzwW1e250T4WqQNiQ=="
		},
		{
		"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/default-packages_grafana-ui_src_components_Layout_Stack_Stack_tsx-packages_grafana-ui_src_com-2a3620.js",
		"integrity": "sha256-+0bPuBGKFGglkXvW4oPiolrNveozRLZVLUrbCYsbVcM= sha384-EIayAgykdDWmyilAuXo4ad96v3tRqdWZp+BHdeDpSSsbAMeg+eoBBbk2Yh219kDg sha512-+jn7kmQ9Id8aTIe66TD+vM+W19cTIVexEfkxbxgqXdJyJ72qalN6ccWyP1ro1w/E1R/laZGNLz1LBc1I4u2Isw=="
		},
		{
		"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/app.js",
		"integrity": "sha256-IOZKp3piC3vddDXP5jy5rIw0vb0KKEOg/k9EGrIxskk= sha384-CBNr5W0pJ23LQMnz5BZI1iVBIExOmF/wpqkEnBtYu9R/yYJIzjpv8KT0a3TBulOi sha512-ockzlzgosuZvLittZrSzh8lexEIZF9iKpy6J9Ii4es3e4D34FpWhHJhDZGpxLVraX4ypLofrDp2Yy0sdUbdi7w=="
		}
	],
	"cssFiles": [
		{
		"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/grafana.app.91aaa9d81398c147a57c.css",
		"integrity": "sha256-77rfikk+dYkH82TOmcmleVoDOHZQdhzVX9gDLcgPbtQ= sha384-IOTlZ1IvTVq5ekKLoaE3/SoZ12K1eExOAnSw9BzkgQ3+RcyQpb1S5hO2w//IIkRB sha512-0Ct3uJBFQIkyxYTvMxseA1cphe2RivXQ2MCbiV0hEm5NzWPiY9sq2P4ay5dXz5v35c++4W47KaknoWlc83bQJQ=="
		}
	],
	"dark": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/grafana.dark.722d809dba5a31f57d49.css",
	"light": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/grafana.light.2fbd901d840329c18394.css",
	"swagger": [
		{
		"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/runtime.js",
		"integrity": "sha256-tM4AGASn3Cb8139+wp3w6rlo3ELFAuUW7K4Pifx226o= sha384-DfxxsYWb0+RxiXOr+wtCSzAAYGecffq/iHyn6CN9tHmaORv1sS+rsrnlnJo2jPQD sha512-qSxdqrx0mJLY1mdkbKrkCyqOoIEgFqzCoY9+uIuFRIVDPFbb2nJy0NtaKMQvDJnAzIrJFwzwW1e250T4WqQNiQ=="
		},
		{
		"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/swagger.js",
		"integrity": "sha256-wLlip7zRYODW/TPcI5JZPRdmWirc1KD+UcNF+8V9RBk= sha384-6VGD+LgCpjMZN/ORSjWcrWa9diUzQO3OfEhP0D2ZluSwP4IT+0kH7KEeD9NVbojd sha512-vZOCFzBZBhd34yGv8z7P4Gw4WLVR9HjpuK0y6Kcw+pCBk5Dv9qHBg3ZVs6s0tOnUmiMWwgL4Ne8f+zgiuJVPqg=="
		}
	],
	"swaggerCssFiles": [
		{
		"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/grafana.swagger.2733d417270d5dd49373.css",
		"integrity": "sha256-GNcHNgIAT7S+J4X7seFjlvNPC1bRhM15d0cQBm3VFoQ= sha384-ywztCBf8uF0tTFjC1mLth33RI2WuFURN3dRy7Bv2PheGzbWJpwlgo9+mtT2Zm7mO sha512-e4c+VedZGqcwLqwfdqRWonggRPO0gjJ7Z0YbXK5z4bFTsUIc+x8ycIJG+eQaf8cuHlsakG4hkWNkRwLBazcFAg=="
		}
	]
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
