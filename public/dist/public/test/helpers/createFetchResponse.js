export function createFetchResponse(data) {
    return {
        data: data,
        status: 200,
        url: 'http://localhost:3000/api/tsdb/query',
        config: { url: 'http://localhost:3000/api/tsdb/query' },
        type: 'basic',
        statusText: 'Ok',
        redirected: false,
        headers: {},
        ok: true,
    };
}
//# sourceMappingURL=createFetchResponse.js.map