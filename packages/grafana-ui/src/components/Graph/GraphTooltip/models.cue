package grafanaschema


// TODO Relative imports are flatly disallowed by CUE, but that's what's
// currently done in the corresponding typescript code. We'll have to make
// cuetsy handle this with import mappings.
import tooltip "github.com/grafana/grafana/packages/grafana-ui/src/components/Chart:grafanaschema"

GraphTooltipOptions: {
    mode: tooltip.TooltipMode
} @cuetsy(targetType="interface")