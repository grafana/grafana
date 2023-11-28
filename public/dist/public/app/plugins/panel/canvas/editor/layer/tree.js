import { FrameState } from 'app/features/canvas/runtime/frame';
export function getTreeData(root, selection, selectedColor) {
    let elements = [];
    if (root) {
        for (let i = root.elements.length; i--; i >= 0) {
            const item = root.elements[i];
            const element = {
                key: item.UID,
                title: item.getName(),
                selectable: true,
                dataRef: item,
            };
            if (item instanceof FrameState) {
                element.children = getTreeData(item, selection, selectedColor);
            }
            elements.push(element);
        }
    }
    return elements;
}
export function onNodeDrop(info, treeData) {
    const destKey = info.node.key;
    const srcKey = info.dragNode.key;
    const destPos = info.node.pos.split('-');
    const destPosition = info.dropPosition - Number(destPos[destPos.length - 1]);
    const loop = (data, key, callback) => {
        data.forEach((item, index, arr) => {
            if (item.key === key) {
                callback(item, index, arr);
                return;
            }
            if (item.children) {
                loop(item.children, key, callback);
            }
        });
    };
    const data = [...treeData];
    // Find dragObject
    let srcElement = undefined;
    loop(data, srcKey, (item, index, arr) => {
        arr.splice(index, 1);
        srcElement = item;
    });
    if (destPosition === 0) {
        // Drop on the content
        loop(data, destKey, (item) => {
            item.children = item.children || [];
            item.children.unshift(srcElement);
        });
    }
    else {
        // Drop on the gap (insert before or insert after)
        let ar = [];
        let i = 0;
        loop(data, destKey, (item, index, arr) => {
            ar = arr;
            i = index;
        });
        if (destPosition === -1) {
            ar.splice(i, 0, srcElement);
        }
        else {
            ar.splice(i + 1, 0, srcElement);
        }
    }
    return data;
}
//# sourceMappingURL=tree.js.map