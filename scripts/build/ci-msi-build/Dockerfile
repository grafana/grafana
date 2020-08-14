FROM mcr.microsoft.com/windows:1809

WORKDIR C:\\App

RUN powershell Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
RUN powershell Invoke-Expression (New-Object System.Net.WebClient).DownloadString('https://get.scoop.sh')
RUN powershell scoop install wixtoolset@3.11.2
#RUN powershell Enable-WindowsOptionalFeature -Online -FeatureName "NetFx3"
#RUN powershell invoke-webrequest https://github.com/wixtoolset/wix3/releases/download/wix3112rtm/wix311-binaries.zip -outfile wix311.zip
#RUN powershell expand-archive wix311.zip
#RUN powershell rm wix311.zip
#RUN powershell [Environment]::SetEnvironmentVariable \
#     ("Path", $env:Path + ';C:\\App\\wix311', [System.EnvironmentVariableTarget]::Machine)