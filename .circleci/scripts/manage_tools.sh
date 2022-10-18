#!/usr/bin/env bash

set -euo pipefail

git_root="$(git rev-parse --show-toplevel)"
readonly git_root="${git_root}"
readonly version_file="${git_root}"/.tool-versions

set -x

add_plugins() {
	check_asdf

	[ -f "$version_file" ] || {
		printf 'ASDF .tool-versions does not exist. Exiting\n'
		return 1
	}

	readarray -t intended_plugins < <(cut -d" " -f1 "${version_file}")
	readarray -t added_plugins < <(asdf plugin-list)
	if [ "${#@}" -eq 0 ]; then
		local -r wanted_plugins=("${intended_plugins[@]}")
	else
		local -r wanted_plugins=("${@}")
	fi

	local plugin
	for plugin in "${wanted_plugins[@]}"; do
		if ! array_contains "${plugin}" "${intended_plugins[@]}"; then
			printf 'The specified tool %s is not specified in ASDF config!\n' "${plugin}"
			printf 'Declared plugins: %s\n' "${intended_plugins[*]}"
			return 1
		fi
	done

	for plugin in "${wanted_plugins[@]}"; do
		if ! array_contains "${plugin}" "${added_plugins[@]}"; then
			printf 'Adding asdf plugin: "%s"\n' "${plugin}"
			asdf plugin add "${plugin}"
		fi
	done
}

install_plugins() {
	check_asdf
	if [ "${#@}" = 0 ]; then
		asdf install
	else
		local plug
		for plug in "${@}"; do
			asdf install "${plug}"
		done
	fi

	if python --version &>/dev/null; then
		printf 'Installing Python tools\n'
		# install python tools
		pushd "${git_root}" >/dev/null
		pip install -r "${git_root}"/requirements.txt
		popd >/dev/null
	fi
	if asdf where python &>/dev/null; then
		asdf reshim python
	fi
}

setup() {
	add_plugins "${@}"
	install_plugins "${@}"
}

main() {
	local -r command="${1:-}"
	shift
	local -r tools=("${@}")
	case "${command:-}" in
	add) add_plugins "${tools[@]}" ;;
	install) install_plugins "${tools[@]}" ;;
	setup | '') setup "${tools[@]}" ;;
	help) print_help ;;
	*)
		printf 'Invalid argument: "%s"\n' "${command}" >&2
		print_help
		return 1
		;;
	esac
}

check_asdf() {
	command -v asdf >/dev/null || {
		printf 'Please install asdf: https://asdf-vm.com/guide/getting-started.html#_3-install-asdf\n' >&2
		return 1
	}
}

array_contains() {
	# Checks if first passed item, exists somewhere in the array passed as second and further arguments
	local -r item="${1?Item required}"
	shift
	local -r arr=("${@}")
	local other
	for other in "${arr[@]}"; do
		if [ "${item}" = "${other}" ]; then
			return 0 # Found the item
		fi
	done
	return 1 # didn't find the item
}

print_help() {
	local -r script_called_name="${BASH_SOURCE[0]}"
	printf 'Usage: %s <add|install|setup> [tool_names]\n' "${script_called_name}" >&2
	printf 'Commands:\n' >&2
	printf '   add - add to asdf plugins from .tool-versions file\n' >&2
	printf '   install - install plugins which have been added into asdf and are versioned in .tool-versions file\n' >&2
	printf '   setup - (default, if no command specified) and & install\n' >&2
	printf 'Can additionally pass names of the tools to limit the install to\n' >&2
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
	main "$@"
fi
