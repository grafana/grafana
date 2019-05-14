var Edge = /** @class */ (function () {
    function Edge() {
    }
    Edge.prototype._linkTo = function (node, direction) {
        if (direction <= 0) {
            node.inputEdges.push(this);
        }
        if (direction >= 0) {
            node.outputEdges.push(this);
        }
        node.edges.push(this);
    };
    Edge.prototype.link = function (inputNode, outputNode) {
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
    };
    Edge.prototype.unlink = function () {
        var pos;
        var inode = this.inputNode;
        var onode = this.outputNode;
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
        this.inputNode = null;
        this.outputNode = null;
    };
    return Edge;
}());
export { Edge };
var Node = /** @class */ (function () {
    function Node(name) {
        this.name = name;
        this.edges = [];
        this.inputEdges = [];
        this.outputEdges = [];
    }
    Node.prototype.getEdgeFrom = function (from) {
        if (!from) {
            return null;
        }
        if (typeof from === 'object') {
            return this.inputEdges.find(function (e) { return e.inputNode.name === from.name; });
        }
        return this.inputEdges.find(function (e) { return e.inputNode.name === from; });
    };
    Node.prototype.getEdgeTo = function (to) {
        if (!to) {
            return null;
        }
        if (typeof to === 'object') {
            return this.outputEdges.find(function (e) { return e.outputNode.name === to.name; });
        }
        return this.outputEdges.find(function (e) { return e.outputNode.name === to; });
    };
    Node.prototype.getOptimizedInputEdges = function () {
        var _this = this;
        var toBeRemoved = [];
        this.inputEdges.forEach(function (e) {
            var inputEdgesNodes = e.inputNode.inputEdges.map(function (e) { return e.inputNode; });
            inputEdgesNodes.forEach(function (n) {
                var edgeToRemove = n.getEdgeTo(_this.name);
                if (edgeToRemove) {
                    toBeRemoved.push(edgeToRemove);
                }
            });
        });
        return this.inputEdges.filter(function (e) { return toBeRemoved.indexOf(e) === -1; });
    };
    return Node;
}());
export { Node };
var Graph = /** @class */ (function () {
    function Graph() {
        this.nodes = {};
    }
    Graph.prototype.createNode = function (name) {
        var n = new Node(name);
        this.nodes[name] = n;
        return n;
    };
    Graph.prototype.createNodes = function (names) {
        var _this = this;
        var nodes = [];
        names.forEach(function (name) {
            nodes.push(_this.createNode(name));
        });
        return nodes;
    };
    Graph.prototype.link = function (input, output) {
        var _this = this;
        var inputArr = [];
        var outputArr = [];
        var inputNodes = [];
        var outputNodes = [];
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
        for (var n = 0; n < inputArr.length; n++) {
            var i = inputArr[n];
            if (typeof i === 'string') {
                var n_1 = this.getNode(i);
                if (!n_1) {
                    throw Error("cannot link input node named " + i + " since it doesn't exist in graph");
                }
                inputNodes.push(n_1);
            }
            else {
                inputNodes.push(i);
            }
        }
        for (var n = 0; n < outputArr.length; n++) {
            var i = outputArr[n];
            if (typeof i === 'string') {
                var n_2 = this.getNode(i);
                if (!n_2) {
                    throw Error("cannot link output node named " + i + " since it doesn't exist in graph");
                }
                outputNodes.push(n_2);
            }
            else {
                outputNodes.push(i);
            }
        }
        var edges = [];
        inputNodes.forEach(function (input) {
            outputNodes.forEach(function (output) {
                edges.push(_this.createEdge().link(input, output));
            });
        });
        return edges;
    };
    Graph.prototype.createEdge = function () {
        return new Edge();
    };
    Graph.prototype.getNode = function (name) {
        return this.nodes[name];
    };
    return Graph;
}());
export { Graph };
export var printGraph = function (g) {
    Object.keys(g.nodes).forEach(function (name) {
        var n = g.nodes[name];
        var outputEdges = n.outputEdges.map(function (e) { return e.outputNode.name; }).join(', ');
        if (!outputEdges) {
            outputEdges = '<none>';
        }
        var inputEdges = n.inputEdges.map(function (e) { return e.inputNode.name; }).join(', ');
        if (!inputEdges) {
            inputEdges = '<none>';
        }
        console.log(n.name + ":\n - links to:   " + outputEdges + "\n - links from: " + inputEdges);
    });
};
//# sourceMappingURL=dag.js.map