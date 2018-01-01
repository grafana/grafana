export const backendSrv = {
  get: jest.fn(),
  post: jest.fn(),
};

export function createNavTree(...args) {
  let root = [];
  let node = root;
  for (let arg of args) {
    let child = { id: arg, url: `/url/${arg}`, text: `${arg}-Text`, children: [] };
    node.push(child);
    node = child.children;
  }
  return root;
}
