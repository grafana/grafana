export class Edge {
    _linkTo(node, direction) {
        if (direction <= 0) {
            node.inputEdges.push(this);
        }
        if (direction >= 0) {
            node.outputEdges.push(this);
        }
        node.edges.push(this);
    }
    link(inputNode, outputNode) {
        if (!inputNode) {
            throw Error('inputNode is required');
        }
        if (!outputNode) {
            throw Error('outputNode is required');
        }
        this.unlink();
        this.inputNode = inputNode;
        this.outputNode = outputNode;
        this._linkTo(inputNode, 1);
        this._linkTo(outputNode, -1);
        return this;
    }
    unlink() {
        let pos;
        const inode = this.inputNode;
        const onode = this.outputNode;
        if (!(inode && onode)) {
            return;
        }
        pos = inode.edges.indexOf(this);
        if (pos > -1) {
            inode.edges.splice(pos, 1);
        }
        pos = onode.edges.indexOf(this);
        if (pos > -1) {
            onode.edges.splice(pos, 1);
        }
        pos = inode.outputEdges.indexOf(this);
        if (pos > -1) {
            inode.outputEdges.splice(pos, 1);
        }
        pos = onode.inputEdges.indexOf(this);
        if (pos > -1) {
            onode.inputEdges.splice(pos, 1);
        }
    }
}
export class Node {
    constructor(name) {
        this.name = name;
        this.edges = [];
        this.inputEdges = [];
        this.outputEdges = [];
    }
    getEdgeFrom(from) {
        if (!from) {
            return null;
        }
        if (typeof from === 'object') {
            return this.inputEdges.find((e) => { var _a; return ((_a = e.inputNode) === null || _a === void 0 ? void 0 : _a.name) === from.name; });
        }
        return this.inputEdges.find((e) => { var _a; return ((_a = e.inputNode) === null || _a === void 0 ? void 0 : _a.name) === from; });
    }
    getEdgeTo(to) {
        if (!to) {
            return null;
        }
        if (typeof to === 'object') {
            return this.outputEdges.find((e) => { var _a; return ((_a = e.outputNode) === null || _a === void 0 ? void 0 : _a.name) === to.name; });
        }
        return this.outputEdges.find((e) => { var _a; return ((_a = e.outputNode) === null || _a === void 0 ? void 0 : _a.name) === to; });
    }
    getOptimizedInputEdges() {
        const toBeRemoved = [];
        this.inputEdges.forEach((e) => {
            var _a;
            const inputEdgesNodes = (_a = e.inputNode) === null || _a === void 0 ? void 0 : _a.inputEdges.map((e) => e.inputNode);
            inputEdgesNodes === null || inputEdgesNodes === void 0 ? void 0 : inputEdgesNodes.forEach((n) => {
                const edgeToRemove = n === null || n === void 0 ? void 0 : n.getEdgeTo(this.name);
                if (edgeToRemove) {
                    toBeRemoved.push(edgeToRemove);
                }
            });
        });
        return this.inputEdges.filter((e) => toBeRemoved.indexOf(e) === -1);
    }
}
export class Graph {
    constructor() {
        this.nodes = {};
    }
    createNode(name) {
        const n = new Node(name);
        this.nodes[name] = n;
        return n;
    }
    createNodes(names) {
        const nodes = [];
        names.forEach((name) => {
            nodes.push(this.createNode(name));
        });
        return nodes;
    }
    link(input, output) {
        let inputArr = [];
        let outputArr = [];
        const inputNodes = [];
        const outputNodes = [];
        if (input instanceof Array) {
            inputArr = input;
        }
        else {
            inputArr = [input];
        }
        if (output instanceof Array) {
            outputArr = output;
        }
        else {
            outputArr = [output];
        }
        for (let n = 0; n < inputArr.length; n++) {
            const i = inputArr[n];
            if (typeof i === 'string') {
                const n = this.getNode(i);
                if (!n) {
                    throw Error(`cannot link input node named ${i} since it doesn't exist in graph`);
                }
                inputNodes.push(n);
            }
            else {
                inputNodes.push(i);
            }
        }
        for (let n = 0; n < outputArr.length; n++) {
            const i = outputArr[n];
            if (typeof i === 'string') {
                const n = this.getNode(i);
                if (!n) {
                    throw Error(`cannot link output node named ${i} since it doesn't exist in graph`);
                }
                outputNodes.push(n);
            }
            else {
                outputNodes.push(i);
            }
        }
        const edges = [];
        inputNodes.forEach((input) => {
            outputNodes.forEach((output) => {
                edges.push(this.createEdge().link(input, output));
            });
        });
        return edges;
    }
    descendants(nodes) {
        if (!nodes.length) {
            return new Set();
        }
        const initialNodes = new Set(isStringArray(nodes) ? nodes.map((n) => this.nodes[n]).filter((n) => n !== undefined) : nodes);
        return this.descendantsRecursive(initialNodes);
    }
    descendantsRecursive(nodes, descendants = new Set()) {
        for (const node of nodes) {
            const newDescendants = new Set();
            for (const { inputNode } of node.inputEdges) {
                if (inputNode && !descendants.has(inputNode)) {
                    descendants.add(inputNode);
                    newDescendants.add(inputNode);
                }
            }
            this.descendantsRecursive(newDescendants, descendants);
        }
        return descendants;
    }
    createEdge() {
        return new Edge();
    }
    getNode(name) {
        return this.nodes[name];
    }
}
export const printGraph = (g) => {
    Object.keys(g.nodes).forEach((name) => {
        const n = g.nodes[name];
        let outputEdges = n.outputEdges.map((e) => { var _a; return (_a = e.outputNode) === null || _a === void 0 ? void 0 : _a.name; }).join(', ');
        if (!outputEdges) {
            outputEdges = '<none>';
        }
        let inputEdges = n.inputEdges.map((e) => { var _a; return (_a = e.inputNode) === null || _a === void 0 ? void 0 : _a.name; }).join(', ');
        if (!inputEdges) {
            inputEdges = '<none>';
        }
        console.log(`${n.name}:\n - links to:   ${outputEdges}\n - links from: ${inputEdges}`);
    });
};
function isStringArray(arr) {
    return arr.length > 0 && typeof arr[0] === 'string';
}
//# sourceMappingURL=dag.js.map