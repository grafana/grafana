import { Trace } from '../types';

import { convertTraceToFlameGraph } from './convertTraceToFlameGraph';

describe('convertTraceToFlameGraph', () => {
  it('correctly converts a trace to a flame graph with 5 levels', () => {
    const flameGraphFrame = convertTraceToFlameGraph(trace);

    expect(flameGraphFrame.fields.length).toEqual(4);

    const level = flameGraphFrame.fields[0];
    const value = flameGraphFrame.fields[1];
    const self = flameGraphFrame.fields[2];
    const label = flameGraphFrame.fields[3];

    expect(level.name).toEqual('level');
    expect(value.name).toEqual('value');
    expect(self.name).toEqual('self');
    expect(label.name).toEqual('label');

    expect(level.values.length).toEqual(value.values.length);
    expect(level.values.length).toEqual(self.values.length);
    expect(level.values.length).toEqual(label.values.length);

    expect(level.values.toArray()).toEqual([0, 1, 2, 3, 1, 2, 3, 4, 2, 3, 4, 4, 5, 3, 3, 4, 4, 1, 1]);
  });
});

const trace = {
  traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
  spans: [
    {
      traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
      processID: 'cca8a4ad-d813-5357-9931-41bf3527341f',
      spanID: '97bd4a53-2ab4-5299-ad5f-dcd9c4ca0e2c',
      flags: 0,
      operationName: 'MongoDB::find',
      references: [],
      startTime: 1675957500461000,
      duration: 4831519,
      tags: [
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/1962804b-cd25-53aa-afe1-963d1a8e22d5',
        },
      ],
      logs: [],
    },
    {
      traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
      processID: 'cca8a4ad-d813-5357-9931-41bf3527341f',
      spanID: 'b1305dd5-eba0-5ffc-bf16-d84d68495d2f',
      flags: 0,
      operationName: 'MySQL::SELECT',
      references: [
        {
          refType: 'CHILD_OF',
          traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
          spanID: '97bd4a53-2ab4-5299-ad5f-dcd9c4ca0e2c',
        },
      ],
      startTime: 1675957505137172,
      duration: 48493,
      tags: [
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/6f966f2d-25a1-5960-ad79-1e3e7879404f',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/0e0879f9-ce6b-5ae6-98ea-d1f66e51f2db',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/ee5186d8-f4c7-5436-b4dd-04b66c528a73',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/edf43c9f-1a84-52af-93c7-6806a90c6d51',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/0c5868bc-bb84-5804-bfd4-c6ff4ce346b7',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/a5408d5a-bab8-55b0-80ea-9ca836d6445e',
        },
      ],
      logs: [],
    },
    {
      traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
      processID: '4d9b1eef-70da-56ae-b1a3-d99c3b802514',
      spanID: 'c85b73b8-7da0-5d5d-b211-8344e0f36884',
      flags: 0,
      operationName: 'MongoDB::find',
      references: [
        {
          refType: 'CHILD_OF',
          traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
          spanID: '3c8ce788-467f-52da-8dca-b9abbbc57163',
        },
      ],
      startTime: 1675957504596085,
      duration: 341426,
      tags: [
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/e2fe05c8-fc65-5657-a527-9d771c3bad53',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/d28e067b-09e3-5704-b8cd-a773e7f4a59f',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/50ab99ed-4080-57aa-8964-ae05dee8c99a',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/bf4d0c40-c65a-52e7-9f3e-070b9d16da08',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/6f60d49a-9db9-50f2-9e72-f9af9b4ec9d3',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/d22951b3-1e71-5407-a16c-422f02bfe540',
        },
      ],
      logs: [],
    },
    {
      traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
      processID: '0e95babe-050b-5b49-97e6-e5c9dbb1001d',
      spanID: 'a980c553-ece6-5a4e-9c52-4a546cb3f6a0',
      flags: 0,
      operationName: 'MongoDB::update',
      references: [
        {
          refType: 'CHILD_OF',
          traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
          spanID: '759fdde3-a76f-5e58-a9ba-3451964138dc',
        },
      ],
      startTime: 1675957503301148,
      duration: 768687,
      tags: [
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/fbdf2042-2d81-52b0-ae46-abe46c406009',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/b0942fff-68aa-5350-ae5a-a2f2ef3eaf10',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/cfe471a8-1cb1-5223-afd7-f86a0de0b1f3',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/a75befb1-a01b-5fc6-95d5-1ef24738aa8f',
        },
      ],
      logs: [],
    },
    {
      traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
      processID: '0e95babe-050b-5b49-97e6-e5c9dbb1001d',
      spanID: '02293226-7548-5fa0-9da0-22262cca25ba',
      flags: 0,
      operationName: 'MySQL::SELECT',
      references: [
        {
          refType: 'CHILD_OF',
          traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
          spanID: '6bbf7801-a307-5853-8750-8fc6f4352996',
        },
      ],
      startTime: 1675957501182187,
      duration: 2917213,
      tags: [
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/89ba382a-bcbf-5f19-ac67-0c8fa301f18b',
        },
      ],
      logs: [],
    },
    {
      traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
      processID: '42fe8223-ee76-5e66-9403-c93677525959',
      spanID: '3c8ce788-467f-52da-8dca-b9abbbc57163',
      flags: 0,
      operationName: 'POST',
      references: [
        {
          refType: 'CHILD_OF',
          traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
          spanID: '759fdde3-a76f-5e58-a9ba-3451964138dc',
        },
      ],
      startTime: 1675957503949604,
      duration: 89946,
      tags: [
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/629af953-4ed3-53ff-8ec9-4de2bb1166b8',
        },
      ],
      logs: [],
    },
    {
      traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
      processID: '42fe8223-ee76-5e66-9403-c93677525959',
      spanID: 'ddbff59c-5c81-585f-9480-f6223b507aea',
      flags: 0,
      operationName: 'MySQL::INSERT',
      references: [
        {
          refType: 'CHILD_OF',
          traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
          spanID: 'd30a0512-cbfa-5a6f-839c-e6451de4d57f',
        },
      ],
      startTime: 1675957503264487,
      duration: 875951,
      tags: [
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/a6664c47-3ed2-5b11-87b1-dabe0d554c9b',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/05dc5637-d90b-55d1-a72c-aa1c44b2d2a7',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/7207ae22-4d4d-5ff7-8a2b-e79e3f06f773',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/3d563221-bd43-53e0-a1e8-5e271c4e2657',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/dcab0c3e-672e-5f75-a6de-0dd119d5fbc7',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/793d82dd-fa1b-5ad9-ab6e-f7fe40581b34',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/bb03fd93-1616-5f24-8941-fceeb4a50a72',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/06931f70-667b-5c39-966f-38f8a59aa690',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/2cda66d3-7b32-5b23-8729-910728661718',
        },
      ],
      logs: [],
    },
    {
      traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
      processID: '4d9b1eef-70da-56ae-b1a3-d99c3b802514',
      spanID: 'f54c9984-43b6-5eba-aa95-4e5c6e5ffaff',
      flags: 0,
      operationName: 'MySQL::SELECT',
      references: [
        {
          refType: 'CHILD_OF',
          traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
          spanID: 'e8f7b486-ae9f-5a5f-8202-4820fdf6c595',
        },
      ],
      startTime: 1675957501372736,
      duration: 3490651,
      tags: [
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/75bc0493-e2c1-5f8d-bca0-e58df8529782',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/9d00d568-70f7-5b0d-bbe1-74d33e129828',
        },
      ],
      logs: [],
    },
    {
      traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
      processID: '4d9b1eef-70da-56ae-b1a3-d99c3b802514',
      spanID: 'd30a0512-cbfa-5a6f-839c-e6451de4d57f',
      flags: 0,
      operationName: 'MongoDB::update',
      references: [
        {
          refType: 'CHILD_OF',
          traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
          spanID: 'b1305dd5-eba0-5ffc-bf16-d84d68495d2f',
        },
      ],
      startTime: 1675957502948987,
      duration: 1261830,
      tags: [
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/7e5fdbf6-8851-5ec3-8513-fc02a6f50a7b',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/5fe22513-674e-5673-bfd4-f48394310bb6',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/52f1ed47-429c-51ad-8dfa-e60ddac11234',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/fe23de04-1e3e-51e3-b8c3-2974f3fb24fe',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/ad499513-f8b0-5d64-adb2-75c5dd7a19c0',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/cde46923-88de-58a0-96dc-d5c678bcade5',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/f6830a84-8922-5b69-90ee-78f79b7f52c8',
        },
      ],
      logs: [],
    },
    {
      traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
      processID: '9a1c963f-9e10-5d82-98a3-f3f4f94df049',
      spanID: 'dd43c3b7-34ef-5102-b26e-ec8ac935a331',
      flags: 0,
      operationName: 'PUT',
      references: [
        {
          refType: 'CHILD_OF',
          traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
          spanID: '3c8ce788-467f-52da-8dca-b9abbbc57163',
        },
      ],
      startTime: 1675957502713795,
      duration: 614556,
      tags: [
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/1f3cd623-0c9d-513c-8c72-49931cac374f',
        },
      ],
      logs: [],
    },
    {
      traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
      processID: 'c2f34db6-972b-5478-bea3-7aab6d6f8feb',
      spanID: 'c66bbccb-ec5f-544a-b3c0-0daf1e0d0286',
      flags: 0,
      operationName: 'MongoDB::update',
      references: [
        {
          refType: 'CHILD_OF',
          traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
          spanID: 'c85b73b8-7da0-5d5d-b211-8344e0f36884',
        },
      ],
      startTime: 1675957501171755,
      duration: 3873507,
      tags: [
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/948ab6ec-cd15-5a18-95f1-9aed2cb5b2e3',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/d2e2805f-172b-55c2-9849-9c752ec7e997',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/0fd33f1f-79f8-52f1-8797-d7380f6538b4',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/72225f7a-b206-5766-b3c0-280769cbe480',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/e452b90a-397d-5483-adfd-43063c34ed25',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/c2dc66c9-d6cd-5401-8d09-c931a25df6a7',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/6d34cd7e-519f-5592-a935-7a7305667cb9',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/936ca68e-282d-59d5-80f6-fd01e78a0aa5',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/44f4cfa0-6b96-5e23-917f-7fc4555fa0bf',
        },
      ],
      logs: [],
    },
    {
      traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
      processID: '42fe8223-ee76-5e66-9403-c93677525959',
      spanID: '759fdde3-a76f-5e58-a9ba-3451964138dc',
      flags: 0,
      operationName: 'GET',
      references: [
        {
          refType: 'CHILD_OF',
          traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
          spanID: '97bd4a53-2ab4-5299-ad5f-dcd9c4ca0e2c',
        },
      ],
      startTime: 1675957501246313,
      duration: 1723744,
      tags: [
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/5e7fd454-a416-5cfd-b920-1465c4b792ff',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/3e8c9be0-9082-5af0-b287-082a8600b325',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/106e3b3f-d519-5042-ae2c-9287902081fd',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/78417ca2-c679-546d-a64b-faf67ae82aff',
        },
      ],
      logs: [],
    },
    {
      traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
      processID: 'c2f34db6-972b-5478-bea3-7aab6d6f8feb',
      spanID: 'e8f7b486-ae9f-5a5f-8202-4820fdf6c595',
      flags: 0,
      operationName: 'MySQL::SELECT',
      references: [
        {
          refType: 'CHILD_OF',
          traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
          spanID: 'c85b73b8-7da0-5d5d-b211-8344e0f36884',
        },
      ],
      startTime: 1675957503109131,
      duration: 1169725,
      tags: [
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/a1e36682-8cdc-56e9-a7ee-c4c241a5129d',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/b6600d16-8bc9-597b-b54c-29a6f6b906ac',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/9515371a-ee63-55fc-bde7-1ebce95df3f8',
        },
      ],
      logs: [],
    },
    {
      traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
      processID: '4d9b1eef-70da-56ae-b1a3-d99c3b802514',
      spanID: 'b0d90eac-dc3a-5bfb-8c92-3581ab77522e',
      flags: 0,
      operationName: 'MongoDB::find',
      references: [
        {
          refType: 'CHILD_OF',
          traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
          spanID: 'e3ed67a2-8a14-53c8-8dda-4c755ae64bdd',
        },
      ],
      startTime: 1675957502047624,
      duration: 257989,
      tags: [
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/4ae38659-23dc-5cc1-af1a-e684f839f29a',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/e901a78d-fa28-5512-9edc-038ad0885369',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/db7abcb1-be79-5c73-9886-40e38f8a228d',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/a750254c-b490-5c10-bb5c-7c6d91f5cc0c',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/3f6a6474-0358-513e-abcf-797eeb2a2d72',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/e01ada57-ced2-532c-a718-0c1b8e569aa3',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/e8612085-f33a-5669-b661-d0639b4a30fb',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/4d540f4e-eb55-526a-8e6f-a7beff8c72ed',
        },
      ],
      logs: [],
    },
    {
      traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
      processID: 'c2f34db6-972b-5478-bea3-7aab6d6f8feb',
      spanID: 'e3ed67a2-8a14-53c8-8dda-4c755ae64bdd',
      flags: 0,
      operationName: 'GET',
      references: [
        {
          refType: 'CHILD_OF',
          traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
          spanID: 'a980c553-ece6-5a4e-9c52-4a546cb3f6a0',
        },
      ],
      startTime: 1675957500578436,
      duration: 1794927,
      tags: [
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/3f568345-641b-5713-8283-54989005d1dd',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/27d04a0e-db32-5867-9f27-458802e5b734',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/0dc6596b-f850-5c81-8fa8-7ce69d7595b6',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/35b9ba0b-9a9c-5321-b488-7f7c9cc01792',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/c01517a0-74ce-5682-a800-12544f3d7551',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/467469db-2505-50e4-ab54-6e59dbac7479',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/0d4753cc-de33-552d-9ef5-5e4a99a9f8ed',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/d13497d7-45f7-5551-9213-dbe7b2289a85',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/ec58e285-c180-550d-9b87-57895eed7005',
        },
      ],
      logs: [],
    },
    {
      traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
      processID: 'c2f34db6-972b-5478-bea3-7aab6d6f8feb',
      spanID: '01db3e71-e59b-50ff-bf91-e172cc4a798c',
      flags: 0,
      operationName: 'PUT',
      references: [
        {
          refType: 'CHILD_OF',
          traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
          spanID: '9849576e-aaf1-5725-a11d-d1e2478308d9',
        },
      ],
      startTime: 1675957501148561,
      duration: 4055313,
      tags: [
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/85b27689-06ec-5a71-9a34-3437531a42ae',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/607b8d66-ce98-5311-9bb6-9eba2f2bb81e',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/fd990420-5941-5f8e-8570-a2a5bf627e45',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/94eb5ece-8265-5646-9cd8-e86fb8a8fa2c',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/dd48c61b-4a70-5414-af90-a0e2f502e77f',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/0275a1bb-8ca5-557c-bfb6-efd6e861880d',
        },
      ],
      logs: [],
    },
    {
      traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
      processID: 'c2f34db6-972b-5478-bea3-7aab6d6f8feb',
      spanID: '36067a08-a09f-59d2-976c-c98189c89a17',
      flags: 0,
      operationName: 'MySQL::INSERT',
      references: [
        {
          refType: 'CHILD_OF',
          traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
          spanID: '97bd4a53-2ab4-5299-ad5f-dcd9c4ca0e2c',
        },
      ],
      startTime: 1675957500938161,
      duration: 500297,
      tags: [
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/1c41a55b-1cee-51f8-a7d4-0e55e4f77c73',
        },
      ],
      logs: [],
    },
    {
      traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
      processID: 'fb678e9c-2f8e-503b-9658-e3fce1a5d626',
      spanID: '9849576e-aaf1-5725-a11d-d1e2478308d9',
      flags: 0,
      operationName: 'GET',
      references: [
        {
          refType: 'CHILD_OF',
          traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
          spanID: '97bd4a53-2ab4-5299-ad5f-dcd9c4ca0e2c',
        },
      ],
      startTime: 1675957501852627,
      duration: 106712,
      tags: [
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/6a1181a8-c955-56e0-a4f0-f6077c5d3c53',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/35bc7c54-c39f-5399-80fc-be24cdda0e22',
        },
      ],
      logs: [],
    },
    {
      traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
      processID: '42fe8223-ee76-5e66-9403-c93677525959',
      spanID: 'e127ccca-0be1-5c56-9b29-03a37b92decb',
      flags: 0,
      operationName: 'MongoDB::find',
      references: [
        {
          refType: 'CHILD_OF',
          traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
          spanID: '97bd4a53-2ab4-5299-ad5f-dcd9c4ca0e2c',
        },
      ],
      startTime: 1675957503458582,
      duration: 1293149,
      tags: [
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/227aba03-1566-56c8-b8a8-661b68510b1f',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/5c8ba4b1-4126-5a7c-baac-3d4be02f4633',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/cfdb4364-eb27-5a21-80e7-10a876b5e98f',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/7802743f-696f-56ac-9ef9-7d3f434fe108',
        },
      ],
      logs: [],
    },
    {
      traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
      processID: '9a1c963f-9e10-5d82-98a3-f3f4f94df049',
      spanID: '6bbf7801-a307-5853-8750-8fc6f4352996',
      flags: 0,
      operationName: 'MongoDB::update',
      references: [
        {
          refType: 'CHILD_OF',
          traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
          spanID: '3c8ce788-467f-52da-8dca-b9abbbc57163',
        },
      ],
      startTime: 1675957501565674,
      duration: 2907286,
      tags: [
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/4597b8f3-b0a4-51fd-b705-2ff4e212dd4d',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/5b2390d9-4d22-532c-988e-230f587a3e53',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/2a880618-0575-54df-ac03-c56822a64776',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/c04a87c7-00da-58b8-b73c-5e5b634a0a3e',
        },
      ],
      logs: [],
    },
    {
      traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
      processID: '42fe8223-ee76-5e66-9403-c93677525959',
      spanID: 'b17f926c-57ec-5eaa-9908-9e6849dda682',
      flags: 0,
      operationName: 'MongoDB::find',
      references: [
        {
          refType: 'CHILD_OF',
          traceID: '883a0044-48d0-5716-95ef-ee4ef6546b3b',
          spanID: '6bbf7801-a307-5853-8750-8fc6f4352996',
        },
      ],
      startTime: 1675957504364970,
      duration: 358465,
      tags: [
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/da7846d8-2ccf-59f5-ab78-f922b8baa811',
        },
      ],
      logs: [],
    },
  ],
  processes: {
    '0e95babe-050b-5b49-97e6-e5c9dbb1001d': {
      processID: '0e95babe-050b-5b49-97e6-e5c9dbb1001d',
      serviceName: 'serviceE',
      tags: [
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/70d6f730-19bc-5840-8b95-b8830c086eb4',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/5a53019e-e96a-5195-ba21-f0a2599a51fd',
        },
      ],
    },
    'c2f34db6-972b-5478-bea3-7aab6d6f8feb': {
      processID: 'c2f34db6-972b-5478-bea3-7aab6d6f8feb',
      serviceName: 'serviceC',
      tags: [
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/b981ec2d-03bb-54e5-a8f4-314fc6a28c61',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/a65dc140-2568-5d42-9a54-b9ed8834b29f',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/e38cea1e-625d-520a-9349-b4cf11b29bbb',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/de81f86e-b8a3-5df1-a513-94b91b996dd1',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/ba4fe111-2638-5c7c-8525-19f1a723a44d',
        },
      ],
    },
    '42fe8223-ee76-5e66-9403-c93677525959': {
      processID: '42fe8223-ee76-5e66-9403-c93677525959',
      serviceName: 'serviceE',
      tags: [
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/ed990c7a-6420-5e94-903f-0127124eb304',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/372f1255-6281-5367-8988-103d2e770cc8',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/50aa650f-d370-5ae2-966a-74f62de038fc',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/7d62a74c-cfa3-54c1-bb81-480182c27c33',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/aff8e6e6-ea63-568c-82f3-af23fd9bf638',
        },
      ],
    },
    'fb678e9c-2f8e-503b-9658-e3fce1a5d626': {
      processID: 'fb678e9c-2f8e-503b-9658-e3fce1a5d626',
      serviceName: 'serviceA',
      tags: [
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/b528e17e-9cff-5d45-88d4-b180bf041eb3',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/d46ef766-f88c-55c0-9e21-cea45a993bc9',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/003c2dd0-7852-50f2-987d-99831a467858',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/9926ef11-2611-51e6-873b-36b34eb1cb17',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/f794db29-24a3-534d-86a5-10ae6fd88f60',
        },
      ],
    },
    '9a1c963f-9e10-5d82-98a3-f3f4f94df049': {
      processID: '9a1c963f-9e10-5d82-98a3-f3f4f94df049',
      serviceName: 'serviceC',
      tags: [
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/556b3e18-860e-5602-89e0-763dd0fcacb5',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/26220cb1-04df-58ab-b585-fab6249fea35',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/f081014d-ea3f-515c-b052-4afbce763bac',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/ba646533-a383-5f1d-b54e-b17d2758975e',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/7c4563a5-b0da-5e62-8eca-3526463dc180',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/3c85638e-c603-5988-8f87-51c636271eee',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/f883247b-c1df-51ea-b67b-6db42d19fb6d',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/0eaedb30-9b84-5abf-a075-4870644634ad',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/2776ab21-e9f1-5104-86b0-92d61d124161',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/a7544529-5e9a-5c7e-a0b3-55668eef81e3',
        },
      ],
    },
    '4d9b1eef-70da-56ae-b1a3-d99c3b802514': {
      processID: '4d9b1eef-70da-56ae-b1a3-d99c3b802514',
      serviceName: 'serviceF',
      tags: [
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/gamma/4a9af00d-c049-5e39-b8dc-e9c9ae378a41',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/cb033476-a53b-58d8-8919-c6b457b576f6',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/b8a43e5d-4891-5afa-9bb7-deaad0c3920b',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/c9f27790-4e32-5df8-b80d-776dbaf05138',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/76ecc936-97e7-5465-9dc5-60a2ab06dbb7',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/68309e5b-550b-5d15-ab4d-95a61ae25967',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/alpha/1ca19523-5c7d-54e6-b1a2-397c9210d543',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/ff46abfd-269f-54e0-9aab-98ad0b9e7f3c',
        },
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/47044356-6e5c-5bfc-aafb-b093225455e1',
        },
      ],
    },
    'cca8a4ad-d813-5357-9931-41bf3527341f': {
      processID: 'cca8a4ad-d813-5357-9931-41bf3527341f',
      serviceName: 'serviceE',
      tags: [
        {
          key: 'http.url',
          type: 'String',
          value: '/v2/beta/05e65462-5626-5413-a8f8-8ac8dba79c8a',
        },
      ],
    },
  },
} as unknown as Trace;
