import usePrevious from 'react-use/lib/usePrevious';
export function useFocusPositionOnLayout(config, nodes, focusedNodeId) {
    const prevLayoutGrid = usePrevious(config.gridLayout);
    let focusPosition;
    if (prevLayoutGrid === true && !config.gridLayout && focusedNodeId) {
        const node = nodes.find((n) => n.id === focusedNodeId);
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