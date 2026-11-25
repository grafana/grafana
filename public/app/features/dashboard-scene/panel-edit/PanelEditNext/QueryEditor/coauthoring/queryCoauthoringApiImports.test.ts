jest.mock('./QueryCoauthoringSessionEngine', () => {
  throw new Error('Discovery eagerly evaluated the session engine');
});
jest.mock('@codemirror/lang-sql', () => {
  throw new Error('Discovery eagerly evaluated the SQL parser');
});

it('discovers the stable synchronous facade without evaluating the engine or SQL parser', async () => {
  const { queryCoauthoringApi } = await import('./queryCoauthoringApi');
  expect(queryCoauthoringApi.version).toBe(1);
  const values: boolean[] = [];
  const stop = queryCoauthoringApi.subscribeAvailability(({ eligible }) => values.push(eligible));
  try {
    expect(values).toEqual([false]);
    expect((await import('./queryCoauthoringApi')).queryCoauthoringApi).toBe(queryCoauthoringApi);
  } finally {
    stop();
  }
});
