import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { StoreState } from '../../../types';
import { fetchThumbnail, updateThumbnail } from '../reducers/thumbnails';

export const useThumbnailImage = (dashboardUid: string, isLightTheme: boolean) => {
  const themeName = isLightTheme ? 'light' : 'dark';

  const thumb = useSelector((state: StoreState) => state.thumbs[dashboardUid]?.[themeName]);

  const dispatch = useDispatch();

  useEffect(() => {
    if (!thumb?.loaded) {
      dispatch(fetchThumbnail({ dashboardUid, themeName }));
    }
  }, [dispatch, thumb?.loaded, dashboardUid, themeName]);

  const update = async (file: File) => {
    dispatch(updateThumbnail({ dashboardUid, themeName, file }));
  };

  return { imageSrc: thumb?.imageSrc, update };
};
