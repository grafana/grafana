export const createTestOrgIfNotExists = (client) => {
  let orgId = 0;

  let res = client.orgs.getByName('k6');
  if (res.status === 404) {
    res = client.orgs.create('k6');
    if (res.status !== 200) {
      throw new Error('Expected 200 response status when creating org');
    }
    return res.json().orgId;
  }

  // This can happen e.g. in Hosted Grafana instances, where even admins
  // cannot see organisations
  if (res.status !== 200) {
    console.info(`unable to get orgs from instance, continuing with default orgId ${orgId}`);
    return orgId;
  }

  return res.json().id;
};

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
  }

  if (res.status !== 200) {
    throw new Error(`expected 200 response status when creating datasource, got ${res.status}`);
  }

  return res.json().id;
};
