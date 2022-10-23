import shortid from 'shortid';

export type Object = {
  data: Record<string, unknown>;
  kind: string;
  uid: string;
};

export type Data = {
  base: Object[]; // objects that are inserted in the test setup and removed only in the teardown
  toWrite: Object[]; // objects that are inserted by scenarios and removed after a short period of time
};

export const readAsObjects = (paths: string[], kind: string): Object[] => {
  return paths.map((p) => ({
    data: JSON.parse(open(p)),
    uid: shortid.generate(),
    kind,
  }));
};

export const getBase = (uniqueObjects: Object[], no: number): Object[] => {
  const base = new Array<Object>(no);
  for (let i = 0; i < no; i++) {
    const obj = uniqueObjects[Math.floor(i % uniqueObjects.length)];
    base[i] = {
      ...obj,
      uid: `${obj.uid}-${Math.floor(i / uniqueObjects.length)}`,
    };
  }

  return base;
};

export const prepareData = (dashboardFilePaths: string[], baseNumber: number): Data => {
  const objects = readAsObjects(dashboardFilePaths, 'dashboard');
  return {
    base: getBase(objects, baseNumber),
    toWrite: objects,
  };
};
