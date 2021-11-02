import usePrevious from 'react-use/lib/usePrevious';
export function useFocusPositionOnLayout(config, nodes, focusedNodeId) {
    var prevLayoutGrid = usePrevious(config.gridLayout);
    var focusPosition;
    if (prevLayoutGrid === true && !config.gridLayout && focusedNodeId) {
        var node = nodes.find(function (n) { return n.id === focusedNodeId; });
        if (node) {
            focusPosition = {
                x: -node.x,
                y: -node.y,
            };
        }
    }
    return focusPosition;
}
//# sourceMappingURL=useFocusPositionOnLayout.js.map