import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { PlaylistPage, PlaylistPageProps } from './PlaylistPage';
import { locationService } from '../../../../packages/grafana-runtime/src';

const fnMock = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...((jest.requireActual('@grafana/runtime') as unknown) as object),
  getBackendSrv: () => ({
    get: fnMock,
  }),
}));

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    isEditor: true,
  },
}));

function getTestContext(propOverrides?: object) {
  const props: PlaylistPageProps = {
    navModel: {
      main: {
        text: 'Playlist',
      },
      node: {
        text: 'playlist',
      },
    },
    route: {
      path: '/playlists',
      component: jest.fn(),
    },
    queryParams: { state: 'ok' },
    match: { params: { name: 'playlist', sourceName: 'test playlist' }, isExact: false, url: 'asdf', path: '' },
    history: locationService.getHistory(),
    location: { pathname: '', hash: '', search: '', state: '' },
  };

  Object.assign(props, propOverrides);

  return render(<PlaylistPage {...props} />);
}

//make sure that the search, cards, and buttons are rendered correctly
// make sure that the playlist title exist
// make sure that the buttons exist

// function rows() {
//   return screen.getAllByRole('row', { name: /playlist item row/i });
// }

describe('PlaylistPage', () => {
  describe('when mounted with a playlist', () => {
    it('then buttons should be rendered correctly', async () => {
      fnMock.mockResolvedValue([
        {
          id: 0,
          name: 'A test playlist',
          interval: '10m',
          items: [
            { title: 'First item', type: 'dashboard_by_id', order: 1, value: '1' },
            { title: 'Middle item', type: 'dashboard_by_id', order: 2, value: '2' },
            { title: 'Last item', type: 'dashboard_by_tag', order: 2, value: 'Last item' },
          ],
        },
      ]);
      const { debug, getByText } = getTestContext();
      expect(getByText(/loading/i)).toBeInTheDocument();
      await waitFor(() => getByText('A test playlist'));
      debug();
      expect(screen.getByRole('button', { name: /Start playlist/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Edit playlist/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Delete playlist/i })).toBeInTheDocument();
    });
  });

  //   describe('when deleting a playlist item', () => {
  //     it('then the item should be removed and other items should be correct', () => {
  //       getTestContext();

  //       expect(rows()).toHaveLength(3);
  //       userEvent.click(within(rows()[2]).getByRole('button', { name: /delete playlist/i }));
  //       expect(rows()).toHaveLength(2);
  //       expectCorrectRow({ index: 0, type: 'id', title: 'first item', first: true });
  //       expectCorrectRow({ index: 1, type: 'id', title: 'middle item', last: true });
  //     });
  //   });
});
