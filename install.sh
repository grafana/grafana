#!/bin/bash
# Aborta o script imediatamente se qualquer comando falhar
set -e

# --- CONFIGURAÇÃO ---
REPO="DuowardTecnologiaEInovacao/grafana"
INSTALL_DIR="/opt/sentinel-ark-grafana"
# --------------------

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}--- Iniciando Instalação Profissional do Sentinel Ark Grafana ---${NC}"

# --- PASSO 1: VERIFICAR E INSTALAR DEPENDÊNCIAS ---
echo -e "\n${YELLOW}>>> Passo 1/6: Verificando e instalando dependências...${NC}"
sudo apt-get update
if ! command -v wget &> /dev/null; then sudo apt-get install -y wget; fi
if ! command -v curl &> /dev/null; then sudo apt-get install -y curl; fi
if ! command -v psql &> /dev/null; then
    echo "PostgreSQL não encontrado. Instalando..."
    sudo apt-get install -y postgresql
else
    echo "PostgreSQL já está instalado."
fi

# --- PASSO 2: PERGUNTAR INFORMAÇÕES DO BANCO DE DADOS ---
echo -e "\n${YELLOW}>>> Passo 2/6: Configuração do Banco de Dados PostgreSQL...${NC}"
read -p "Digite o nome para o banco de dados [padrão: grafana]: " DB_NAME
DB_NAME=${DB_NAME:-grafana}  # Usa 'grafana' se o usuário não digitar nada

read -p "Digite o nome para o usuário do banco de dados [padrão: grafana]: " DB_USER
DB_USER=${DB_USER:-grafana}  # Usa 'grafana' se o usuário não digitar nada

# --- PASSO 3: CONFIGURAR O BANCO DE DADOS POSTGRESQL ---
echo -e "\n${YELLOW}>>> Passo 3/6: Configurando o banco de dados e usuário...${NC}"
DB_PASSWORD=$(openssl rand -base64 12)

if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo "Banco de dados '$DB_NAME' já existe."
else
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;"
fi

if sudo -u postgres psql -c '\du' | cut -d \| -f 1 | grep -qw "$DB_USER"; then
    echo "Usuário '$DB_USER' já existe. Alterando a senha..."
    sudo -u postgres psql -c "ALTER USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';"
else
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';"
fi
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

# --- PASSO 4: INSTALAR O GRAFANA CUSTOMIZADO ---
echo -e "\n${YELLOW}>>> Passo 4/6: Baixando e instalando a última release do Sentinel Ark Grafana...${NC}"
DOWNLOAD_URL=$(curl -s "https://api.github.com/repos/$REPO/releases/latest" | grep "browser_download_url" | grep ".tar.gz" | cut -d '"' -f 4)
wget -q -O /tmp/grafana-custom.tar.gz "$DOWNLOAD_URL"
sudo rm -rf "$INSTALL_DIR"
sudo mkdir -p "$INSTALL_DIR"
sudo tar -xzf /tmp/grafana-custom.tar.gz -C "$INSTALL_DIR" --strip-components=1
rm /tmp/grafana-custom.tar.gz

# --- PASSO 5: CONFIGURAR O GRAFANA (USANDO O TEMPLATE) ---
echo -e "\n${YELLOW}>>> Passo 5/6: Criando arquivo de configuração a partir do template...${NC}"
TEMPLATE_URL="https://raw.githubusercontent.com/$REPO/main/conf/custom.ini.template"
CONFIG_FILE="$INSTALL_DIR/conf/custom.ini"
PASSWORD_FILE="$INSTALL_DIR/conf/.pgpass"

wget -q -O /tmp/custom.ini.template "$TEMPLATE_URL"

# Substitui todos os placeholders de uma vez
sed -e "s/%%DB_NAME%%/$DB_NAME/" \
    -e "s/%%DB_USER%%/$DB_USER/" \
    -e "s/%%DB_PASSWORD%%/$DB_PASSWORD/" \
    /tmp/custom.ini.template | sudo tee "$CONFIG_FILE" > /dev/null
rm /tmp/custom.ini.template

# --- PASSO 6: ARMAZENAR A SENHA E AJUSTAR PERMISSÕES ---
echo -e "\n${YELLOW}>>> Passo 6/6: Armazenando a senha e ajustando permissões...${NC}"
echo "$DB_PASSWORD" | sudo tee "$PASSWORD_FILE" > /dev/null
sudo chmod 640 "$PASSWORD_FILE"

if ! id "grafana" &>/dev/null; then sudo useradd -rs /bin/false grafana; fi
sudo chown -R grafana:grafana "$INSTALL_DIR"

# --- FINALIZAÇÃO ---
echo ""
echo -e "${GREEN}✅ Instalação concluída com sucesso!${NC}"
echo "Um banco de dados PostgreSQL foi configurado."
echo -e "A senha para o usuário '${DB_USER}' do banco foi salva em: ${YELLOW}${PASSWORD_FILE}${NC}"
echo "Para visualizá-la, use o comando: sudo cat ${PASSWORD_FILE}"
echo ""
echo "Para iniciar o servidor, execute:"
echo "sudo $INSTALL_DIR/bin/grafana server --homepath $INSTALL_DIR"