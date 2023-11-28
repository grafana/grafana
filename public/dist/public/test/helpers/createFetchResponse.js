export function createFetchResponse(data) {
    return {
        data,
        status: 200,
        url: 'http://localhost:3000/api/ds/query',
        config: { url: 'http://localhost:3000/api/ds/query' },
        type: 'basic',
        statusText: 'Ok',
        redirected: false,
        headers: {},
        ok: true,
    };
}
//# sourceMappingURL=createFetchResponse.js.map