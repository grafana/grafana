export class Edge {
  inputNode?: Node;
  outputNode?: Node;

  _linkTo(node: Node, direction: number) {
    if (direction <= 0) {
      node.inputEdges.push(this);
    }

    if (direction >= 0) {
      node.outputEdges.push(this);
    }

    node.edges.push(this);
  }

  link(inputNode: Node, outputNode: Node) {
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
  name: string;
  edges: Edge[];
  inputEdges: Edge[];
  outputEdges: Edge[];

  constructor(name: string) {
    this.name = name;
    this.edges = [];
    this.inputEdges = [];
    this.outputEdges = [];
  }

  getEdgeFrom(from: string | Node): Edge | null | undefined {
    if (!from) {
      return null;
    }

    if (typeof from === 'object') {
      return this.inputEdges.find((e) => e.inputNode?.name === from.name);
    }

    return this.inputEdges.find((e) => e.inputNode?.name === from);
  }

  getEdgeTo(to: string | Node): Edge | null | undefined {
    if (!to) {
      return null;
    }

    if (typeof to === 'object') {
      return this.outputEdges.find((e) => e.outputNode?.name === to.name);
    }

    return this.outputEdges.find((e) => e.outputNode?.name === to);
  }

  getOptimizedInputEdges(): Edge[] {
    const toBeRemoved: Edge[] = [];
    this.inputEdges.forEach((e) => {
      const inputEdgesNodes = e.inputNode?.inputEdges.map((e) => e.inputNode);

      inputEdgesNodes?.forEach((n) => {
        const edgeToRemove = n?.getEdgeTo(this.name);
        if (edgeToRemove) {
          toBeRemoved.push(edgeToRemove);
        }
      });
    });

    return this.inputEdges.filter((e) => toBeRemoved.indexOf(e) === -1);
  }
}

export class Graph {
  nodes: Record<string, Node> = {};

  constructor() {}

  createNode(name: string): Node {
    const n = new Node(name);
    this.nodes[name] = n;
    return n;
  }

  createNodes(names: string[]): Node[] {
    const nodes: Node[] = [];
    names.forEach((name) => {
      nodes.push(this.createNode(name));
    });
    return nodes;
  }

  link(input: string | string[] | Node | Node[], output: string | string[] | Node | Node[]): Edge[] {
    let inputArr = [];
    let outputArr = [];
    const inputNodes: Node[] = [];
    const outputNodes: Node[] = [];

    if (input instanceof Array) {
      inputArr = input;
    } else {
      inputArr = [input];
    }

    if (output instanceof Array) {
      outputArr = output;
    } else {
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
      } else {
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
      } else {
        outputNodes.push(i);
      }
    }

    const edges: Edge[] = [];
    inputNodes.forEach((input) => {
      outputNodes.forEach((output) => {
        if (this.willCreateCycle(input, output)) {
          throw Error(`cannot link ${input.name} to ${output.name} since it would create a cycle`);
        }
        edges.push(this.createEdge().link(input, output));
      });
    });
    return edges;
  }

  descendants(nodes: Node[] | string[]): Set<Node> {
    if (!nodes.length) {
      return new Set();
    }

    const initialNodes = new Set(
      isStringArray(nodes) ? nodes.map((n) => this.nodes[n]).filter((n) => n !== undefined) : nodes
    );

    return this.descendantsRecursive(initialNodes);
  }

  private descendantsRecursive(nodes: Set<Node>, descendants = new Set<Node>()): Set<Node> {
    for (const node of nodes) {
      const newDescendants = new Set<Node>();
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

  private willCreateCycle(input: Node, output: Node): boolean {
    if (input === output) {
      return true;
    }

    // Perform a DFS to check if the input node is reachable from the output node
    const visited = new Set<Node>();
    const stack = [output];

    while (stack.length) {
      const current = stack.pop()!;
      if (current === input) {
        return true;
      }

      visited.add(current);

      for (const edge of current.outputEdges) {
        const next = edge.outputNode;
        if (next && !visited.has(next)) {
          stack.push(next);
        }
      }
    }

    return false;
  }

  createEdge(): Edge {
    return new Edge();
  }

  getNode(name: string): Node {
    return this.nodes[name];
  }
}

export const printGraph = (g: Graph) => {
  Object.keys(g.nodes).forEach((name) => {
    const n = g.nodes[name];
    let outputEdges = n.outputEdges.map((e: Edge) => e.outputNode?.name).join(', ');
    if (!outputEdges) {
      outputEdges = '<none>';
    }
    let inputEdges = n.inputEdges.map((e: Edge) => e.inputNode?.name).join(', ');
    if (!inputEdges) {
      inputEdges = '<none>';
    }
    console.log(`${n.name}:\n - links to:   ${outputEdges}\n - links from: ${inputEdges}`);
  });
};

function isStringArray(arr: unknown[]): arr is string[] {
  return arr.length > 0 && typeof arr[0] === 'string';
}
