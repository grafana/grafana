# Ansi color code variables
red="\e[0;91m"
blue="\e[0;94m"
green="\e[0;92m"
reset="\e[0m"


pause() {
    if [[ "$no_pause" != "--no-pause" ]]; then
        read -p "Press [Enter] key to resume ..."
    fi
}
