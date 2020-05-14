local arr = std.range(1, 100);

{
    "apiVersion": 1,
    "datasources": [
        {
            "name": 'gfdev-bulkalerting-' + counter,
            "type": "prometheus",
            "access": "proxy",
            "url": "http://localhost:9090"
        }
        for counter in arr
    ],
}
