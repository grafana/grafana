import { HttpResponse, http } from 'msw';

import { mockSilences } from 'app/features/alerting/unified/mocks';

//////////////
// Silences //
//////////////

export const silencesListHandler = (silences = mockSilences) =>
  http.get('/api/alertmanager/:datasourceUid/api/v2/silences', () => HttpResponse.json(silences));

export const silenceGetHandler = () =>
  http.get<{ uuid: string }>('/api/alertmanager/:datasourceUid/api/v2/silence/:uuid', ({ params }) => {
    const { uuid } = params;
    const matchingMockSilence = mockSilences.find((silence) => silence.id === uuid);
    if (matchingMockSilence) {
      return HttpResponse.json(matchingMockSilence);
    }

    return HttpResponse.json({ message: 'silence not found' }, { status: 404 });
  });

export const silenceCreateHandler = () =>
  http.post('/api/alertmanager/:datasourceUid/api/v2/silences', () =>
    HttpResponse.json({ silenceId: '4bda5b38-7939-4887-9ec2-16323b8e3b4e' })
  );
