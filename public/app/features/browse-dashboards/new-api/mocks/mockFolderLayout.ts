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

const joinNumbers = (...numbers: number[]) => numbers.join('.');

export const folderLayout = [
  ...arrayOf(123, (index) =>
    $folder(index.toString(), [
      ...arrayOf(63, (index2) => $folder(joinNumbers(index, index2))),
      ...arrayOf(123, (index2) => $dash(joinNumbers(index, index2))),
    ])
  ),
  ...arrayOf(123, (index) => $dash(index.toString())),
];
