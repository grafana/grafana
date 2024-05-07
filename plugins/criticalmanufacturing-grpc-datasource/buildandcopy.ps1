param([switch] $p, [switch] $b, [switch] $f)

if ($p) {
    pushd ..\..\..\DataManager\proto\
    protoc --go_out=..\..\Grafana\plugins\criticalmanufacturing-grpc-datasource\pkg\proto --go_opt=paths=source_relative --go-grpc_out=..\..\Grafana\plugins\criticalmanufacturing-grpc-datasource\pkg\proto --go-grpc_opt=paths=source_relative .\DataManager.proto
    popd
}

if ($b) {
    mage -v
}

if ($f) {
    yarn build
}

Stop-Service Grafana
Copy-Item -Path .\dist\* -Destination "C:\Program Files\GrafanaLabs\grafana\data\plugins\criticalmanufacturing-grpc-datasource" -recurse -Force
Start-Service Grafana