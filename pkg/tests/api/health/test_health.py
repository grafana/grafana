import json
import unittest
from urllib import error, request


class TestGrafanaHealthAPI(unittest.TestCase):
    def test_health_endpoint(self):
        url = "http://localhost:3000/api/health"
        try:
            with request.urlopen(url) as response:
                body = response.read()
        except error.URLError:
            self.skipTest("Grafana server is not running")
        data = json.loads(body.decode())
        self.assertIn("database", data)
        self.assertEqual(data.get("database"), "ok")



if __name__ == "__main__":
    unittest.main()