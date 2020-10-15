# This has to correspond to the version the Drone runners have
FROM mcr.microsoft.com/windows:1809

WORKDIR C:\\App

RUN powershell Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
RUN powershell Invoke-Expression (New-Object System.Net.WebClient).DownloadString('https://get.scoop.sh')
# Scoop first of all needs git to update itself
# Run Scoop under PowerShell since it can otherwise fail
RUN powershell -Command scoop install git@2.28.0.windows.1
RUN powershell -Command scoop install go@1.15.2 unzip@6.00

# Install diffutils, in case we need them
RUN powershell (New-Object Net.WebClient).DownloadFile(\
  \"https://sourceforge.net/projects/gnuwin32/files/diffutils/2.8.7-1/diffutils-2.8.7-1-bin.zip\", \
  \"diffutils-bin.zip\")
RUN powershell (New-Object Net.WebClient).DownloadFile(\
  \"https://sourceforge.net/projects/gnuwin32/files/diffutils/2.8.7-1/diffutils-2.8.7-1-dep.zip\", \
  \"diffutils-dep.zip\")
RUN mkdir -p "C:\Program Files (x86)\GnuWin32"
RUN cd "C:\Program Files (x86)\GnuWin32" && unzip C:\App\diffutils-dep.zip && unzip C:\App\diffutils-bin.zip

RUN powershell (New-Object Net.WebClient).DownloadFile(\
  \"https://github.com/golangci/golangci-lint/releases/download/v1.31.0/golangci-lint-1.31.0-windows-amd64.zip\", \
  \"golangci-lint.zip\")
RUN powershell (Get-FileHash golangci-lint.zip -Algorithm SHA256).Hash -eq \
  \"6CE6B1D3207A63256D82FBBAC80BB9E85D7705EC1A408F005DFE324457C54966\"
RUN unzip golangci-lint.zip
RUN powershell -Command mv golangci-lint-1.31.0-windows-amd64\golangci-lint.exe .

RUN powershell -Command scoop cache rm '*'

RUN powershell -Command mkdir -p $(Split-Path -Path $profile)
RUN powershell Set-Content -Path $profile -Value '$env:Path += \";C:\App;C:\Program files (x86)\GnuWin32\bin\"'

ENTRYPOINT ["cmd"]
