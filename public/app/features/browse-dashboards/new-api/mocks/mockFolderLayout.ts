import Chance from 'chance';

export interface MockDashboard {
  kind: 'dashboard';
  uid: string;
  title: string;
}

export interface MockFolder {
  kind: 'folder';
  uid: string;
  title: string;
  children: Array<MockDashboard | MockFolder>;
}

const chance = new Chance(1);

function arrayOf<T>(length: number, mapFn: (index: number) => T): T[] {
  const arr = new Array(length).fill(undefined);

  if (!mapFn) {
    return arr;
  }

  return arr.map((_, index) => mapFn(index));
}

function $folder(title?: string, children: MockFolder['children'] = []): MockFolder {
  const randomTitle = chance.company();

  return {
    kind: 'folder',
    uid: chance.bb_pin(),
    title: title ? `${title} ${randomTitle}` : randomTitle,
    children: children,
  };
}

function $dash(title?: string): MockDashboard {
  const randomTitle = chance.name({ middle_initial: true });

  return {
    kind: 'dashboard',
    uid: chance.bb_pin(),
    title: title ? `${title} ${randomTitle}` : randomTitle,
  };
}

const join = (...numbers: number[]) => numbers.join('.');

export const folderLayout = [
  ...arrayOf(60, (index) =>
    $folder(index.toString(), [
      ...arrayOf(10, (index2) =>
        $folder(join(index, index2), [
          ...arrayOf(3, (index3) => $folder(join(index, index2, index3))),
          ...arrayOf(3, (index3) => $dash(join(index, index2, index3))),
        ])
      ),
      ...arrayOf(60, (index2) => $dash(join(index, index2))),
    ])
  ),

  ...arrayOf(60, (index) => $dash(index.toString())),
];

export function getChildrenOfFolder(
  folderUID: string,
  items: Array<MockFolder | MockDashboard>
): Array<MockDashboard | MockFolder> | undefined {
  for (const item of items) {
    if (item.kind !== 'folder') {
      continue;
    }

    if (item.uid === folderUID) {
      return item.children;
    }

    if (item.children.length) {
      const children = getChildrenOfFolder(folderUID, item.children);
      if (children) {
        return children;
      }
    }
  }

  return undefined;
}
