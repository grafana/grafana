#Port definition
$port=633
#Plugin name definition
$plugin= "cmf_backend_grpc_plugin_windows_amd64"

$procid=get-process $plugin |select -expand id

Write-Host "PID:" $procid
Write-Host "Port:" $port

dlv attach $procid --headless --listen=:$port --api-version 2 --log
taskkill /im dlv /f