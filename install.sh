#!/bin/bash

# --- Script para instalar a versão customizada do Grafana ---
DOWNLOAD_URL="https://github.com/DuowardTecnologiaEInovacao/grafana/releases/download/v1.0/sentinel-ark-grafana-v1.0.tar.gz"
INSTALL_DIR="/opt/sentinel-ark-grafana"
# -----------------------------------------------------------

echo ">>> Baixando sua versão customizada do Grafana..."
wget -q -O /tmp/grafana-custom.tar.gz "$DOWNLOAD_URL"

echo ">>> Removendo instalações antigas em $INSTALL_DIR..."
sudo rm -rf "$INSTALL_DIR"

echo ">>> Instalando na pasta $INSTALL_DIR..."
sudo mkdir -p "$INSTALL_DIR"
sudo tar -xzf /tmp/grafana-custom.tar.gz -C "$INSTALL_DIR" --strip-components=1

echo ">>> Limpando o arquivo de download..."
rm /tmp/grafana-custom.tar.gz

echo ""
echo "✅ Instalação concluída com sucesso!"
echo "Para iniciar o servidor, execute o comando:"
echo "sudo $INSTALL_DIR/bin/grafana server --homepath $INSTALL_DIR"
