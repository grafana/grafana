import { useGetFolderQueryFacade } from 'app/api/clients/folder/v1beta1/hooks';
import { FolderDTO } from 'app/types/folders';

interface ReturnBag {
  folder?: FolderDTO;
  loading: boolean;
}

/**
 * Returns a folderDTO for the given uid – uses cached values
 * @TODO propagate error state
 */
export function useFolder(uid?: string): ReturnBag {
  const fetchFolderState = useGetFolderQueryFacade(uid);

  return {
    loading: fetchFolderState.isLoading,
    folder: fetchFolderState.data,
  };
}

export function stringifyFolder({ title, parents }: FolderDTO) {
  return parents && parents?.length
    ? [...parents.map((p) => p.title), title].map(encodeTitle).join('/')
    : encodeTitle(title);
}

function encodeTitle(title: string): string {
  return title.replaceAll('/', '\\/');
}
