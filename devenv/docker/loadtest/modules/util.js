export const createTestOrgIfNotExists = (client) => {
  let res = client.orgs.getByName('k6');
  if (res.status === 404) {
    res = client.orgs.create('k6');
    if (res.status !== 200) {
      throw new Error('Expected 200 response status when creating org');
    }
  }

  client.withOrgId(res.json().orgId);
}

export const createTestdataDatasourceIfNotExists = (client) => {
  const payload = {
    access: 'proxy',
    isDefault: false,
    name: 'k6-testdata',
    type: 'testdata',
  };

  let res = client.datasources.getByName(payload.name);
  if (res.status === 404) {
    res = client.datasources.create(payload);
    if (res.status !== 200) {
      throw new Error('Expected 200 response status when creating datasource');
    }
  }

  return res.json().id;
}
