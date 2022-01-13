import { useEffect, useState } from 'react';

// TODO reduxify

export const getThumbnailURL = (uid: string, isLight?: boolean) =>
  `/api/dashboards/uid/${uid}/img/thumb/${isLight ? 'light' : 'dark'}`;

export type GetThumbnailResponse = {
  imageDataUrl?: string;
};

type State = {
  loading: boolean;
  imageSrc: string | undefined;
};

const fetchThumbnail = async (dashboardUid: string, isLight: boolean, setState: (state: State) => void) => {
  const url = getThumbnailURL(dashboardUid, isLight);
  const res = await fetch(url);
  if (res.status !== 200) {
    return;
  }

  const resBody: GetThumbnailResponse = await res.json();
  setState({
    loading: false,
    imageSrc: resBody?.imageDataUrl,
  });
};

export const useThumbnail = (dashboardUid: string, isLightTheme: boolean) => {
  const [{ loading, imageSrc }, setState] = useState<State>({
    loading: true,
    imageSrc: undefined,
  });

  useEffect(() => {
    setState((prevState) => ({
      ...prevState,
      loading: true,
    }));
    fetchThumbnail(dashboardUid, isLightTheme, setState);
  }, [dashboardUid, isLightTheme]);

  const update = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(getThumbnailURL(dashboardUid, isLightTheme), {
        method: 'POST',
        body: formData,
      });
      if (res.status !== 200) {
        const body = await res.json();
        console.log(`error: ${res.status} ${JSON.stringify(body)}`);
      }

      await fetchThumbnail(dashboardUid, isLightTheme, setState);
    } catch (err) {
      console.log('error ', err.stack);
    }
  };

  return { loading, imageSrc, update };
};
