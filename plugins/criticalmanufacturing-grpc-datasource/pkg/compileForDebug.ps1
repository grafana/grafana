go build -gcflags=all="-N -l" -o ..\dist\cmf_backend_grpc_plugin_windows_amd64.exe

Stop-Service Grafana
Copy-Item ..\dist\cmf_backend_grpc_plugin_windows_amd64.exe -Destination "C:\Program Files\GrafanaLabs\grafana\data\plugins\criticalmanufacturing-grpc-datasource" -recurse -Force
Start-Service Grafana