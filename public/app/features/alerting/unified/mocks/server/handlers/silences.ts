import { HttpResponse, http } from 'msw';

import { mockSilences } from 'app/features/alerting/unified/mocks';
import { MOCK_DATASOURCE_UID_BROKEN_ALERTMANAGER } from 'app/features/alerting/unified/mocks/server/handlers/datasources';

const silencesListHandler = (silences = mockSilences) =>
  http.get<{ datasourceUid: string }>('/api/alertmanager/:datasourceUid/api/v2/silences', ({ params, request }) => {
    if (params.datasourceUid === MOCK_DATASOURCE_UID_BROKEN_ALERTMANAGER) {
      return HttpResponse.json({ traceId: '' }, { status: 502 });
    }

    // Server only responds with ACL/rule metadata if query param is sent
    const accessControlQueryParam = new URL(request.url).searchParams.get('accesscontrol');
    const ruleMetadataQueryParam = new URL(request.url).searchParams.get('ruleMetadata');

    const mappedSilences = silences.map(({ accessControl, metadata, ...silence }) => {
      return {
        ...silence,
        ...(accessControlQueryParam && { accessControl }),
        ...(ruleMetadataQueryParam && { metadata }),
      };
    });

    return HttpResponse.json(mappedSilences);
  });

const silenceGetHandler = () =>
  http.get<{ uuid: string }>('/api/alertmanager/:datasourceUid/api/v2/silence/:uuid', ({ params, request }) => {
    const { uuid } = params;
    const matchingMockSilence = mockSilences.find((silence) => silence.id === uuid);
    if (!matchingMockSilence) {
      return HttpResponse.json({ message: 'silence not found' }, { status: 404 });
    }

    // Server only responds with ACL/rule metadata if query param is sent
    const accessControlQueryParam = new URL(request.url).searchParams.get('accesscontrol');
    const ruleMetadataQueryParam = new URL(request.url).searchParams.get('ruleMetadata');

    const { accessControl, metadata, ...silence } = matchingMockSilence;

    return HttpResponse.json({
      ...silence,
      ...(accessControlQueryParam && { accessControl }),
      ...(ruleMetadataQueryParam && { metadata }),
    });
  });

export const silenceCreateHandler = () =>
  http.post('/api/alertmanager/:datasourceUid/api/v2/silences', () =>
    HttpResponse.json({ silenceId: '4bda5b38-7939-4887-9ec2-16323b8e3b4e' })
  );

const handlers = [silencesListHandler(), silenceGetHandler(), silenceCreateHandler()];
export default handlers;
