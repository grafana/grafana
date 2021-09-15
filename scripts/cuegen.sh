#!/usr/bin/env bash
set -eo pipefail

# MUST BE RUN FROM GRAFANA ROOT DIR
test -d cue

# Must have latest cue and cuetsy
if ! command -v cue &> /dev/null; then
    echo "must install cue on PATH"
    exit 1
fi
if ! command -v cuetsy &> /dev/null; then
    echo "must install cuetsy on PATH"
    exit 1
fi

# TODO Everything here needs to be moved into custom CUE logic in a Go program.
# It _might_ be possible to do what we want with some CUE tools magic
# (https://pkg.go.dev/cuelang.org/go@v0.3.0-beta.5/pkg/tool), but unless that
# turns out to be pretty straightforward, it's probably better to encode our
# filesystem semantics there.

# Enumerate and move all CUE files under packages/grafana-{data,ui} into
# respective cue subdir. These subdirs are where we place assembled
# definitions, where Go loads from, and where other CUE - including CUE defined
# in plugins - import from.
mkdir -p cue/ui cue/data
rm -f {cue/ui/gen.cue,cue/data/gen.cue}

# TODO decide if multiple or single files seems like better ergonomics
# shellcheck disable=SC2046
cue def -s $(find packages/grafana-ui -type f -name "*.cue") > cue/ui/gen.cue
# shellcheck disable=SC2046
cue def -s $(find packages/grafana-data -type f -name "*.cue") > cue/data/gen.cue

# Horrible hack to remove import statements. 
#
# HACK-IMPOSED CONSTRAINT: Only works for single-line imports, so we can ONLY use
# single-line imports in CUE files until this is improved! Expressly only here
# as a hack because we can't make this better with vanilla cue.
#
# HACK-IMPOSED CONSTRAINT: Can't import between @grafana/ui and @grafana/data,
# because those imports will also be removed
# 
# TODO move a more careful import-elimination check into a Go tool
#
# It's important to understand why this is necessary, though. We are expecting
# that these core components may depend on each other - e.g., how
# VizTooltipOptions composes in TooltipDisplayMode. We have to preserve those
# literal identifiers in our assembled CUE, so that when a panel plugin's
# models.cue imports and references something like VizTooltipOptions in CUE,
# it's still the same identifier as appeared in the original core models.cue
# files, AND therefore is exactly the identifier that appears in
# cuetsy-generated @grafana/{ui,data} packages. That is, as long as we preserve
# the relation between the identifier "VizTooltipOptions" as a top-level
# importable thing at all stages on the CUE side, then everything on the
# TypeScript side will line up.
sed -i -e 's/^import.*//g' {cue/ui/gen.cue,cue/data/gen.cue}

# Remove all qualified identifiers
# (https://cuelang.org/docs/references/spec/#qualified-identifiers) from the
# generated CUE files.
# 
# Even worse hack than the above, but part and parcel with having imports. By
# assembling the CUE inputs together into a single dir in a single package (and
# even in a single file, though single dir is sufficient), we've obviated the
# need for imports and qualified identifiers; CUE's loader logic concats
# everything into a single instance.
#
# HACK-IMPOSED CONSTRAINT: No selectors (foo.bar,
# https://cuelang.org/docs/references/spec/#qualified-identifiers), at all.
# Thus, no nested identifiers. This is a horrible sledgehammer. It makes it
# impossible to correctly consume a CUE file that references a nested
# identifier (foo.bar), because this stupid logic can't disambiguate between
# those and referencing a label from an import.
#
# HACK-IMPOSED CONSTRAINT: We can't experiment with the sort of complex
# structures necessary for revisioning as long as we're doing this, as they're
# necessarily going to involve some nesting.
#
# TODO move into grafana-cli and do a more careful check that we're only
# eliminating qualified identifiers from imports we're also eliminating
sed -i -e "s/[A-Za-z]*\.\([A-Za-z]*\)/\1/g" {cue/ui/gen.cue,cue/data/gen.cue}

# uuuugghhhh OSX sed
rm -f {cue/ui/gen.cue-e,cue/data/gen.cue-e}

# Check that our output is still valid CUE.
cue eval -E {cue/ui/gen.cue,cue/data/gen.cue} > /dev/null

# Run cuetsy over all core .cue files.
find packages -type f -name '*.cue' -exec cuetsy {} \;
find public/app/plugins -type f -name '*.cue' -exec cuetsy {} \;