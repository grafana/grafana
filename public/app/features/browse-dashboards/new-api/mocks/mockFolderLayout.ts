import Chance from 'chance';

interface MockDashboard {
  kind: 'dashboard';
  uid: string;
  title: string;
}

interface MockFolder {
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

function $folder(children: MockFolder['children'] = []): MockFolder {
  return {
    kind: 'folder',
    uid: chance.guid(),
    title: chance.company(),
    children: children,
  };
}

function $dash(): MockDashboard {
  return {
    kind: 'dashboard',
    uid: chance.guid(),
    title: chance.name({ middle_initial: true }),
  };
}

export const folderLayout = [...arrayOf(123, (index) => $folder()), ...arrayOf(123, (index) => $dash())];
