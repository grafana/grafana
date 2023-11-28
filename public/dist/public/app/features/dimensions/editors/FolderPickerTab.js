import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { Field, FilterInput, Select, useStyles2 } from '@grafana/ui';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { MediaType, ResourceFolderName } from '../types';
import { ResourceCards } from './ResourceCards';
const getFolders = (mediaType) => {
    if (mediaType === MediaType.Icon) {
        return [ResourceFolderName.Icon, ResourceFolderName.IOT, ResourceFolderName.Marker];
    }
    else {
        return [ResourceFolderName.BG];
    }
};
const getFolderIfExists = (folders, path) => {
    var _a;
    return (_a = folders.find((folder) => path.startsWith(folder.value))) !== null && _a !== void 0 ? _a : folders[0];
};
export const FolderPickerTab = (props) => {
    const { value, mediaType, folderName, newValue, setNewValue } = props;
    const styles = useStyles2(getStyles);
    const folders = getFolders(mediaType).map((v) => ({
        label: v,
        value: v,
    }));
    const [searchQuery, setSearchQuery] = useState();
    const [currentFolder, setCurrentFolder] = useState(getFolderIfExists(folders, (value === null || value === void 0 ? void 0 : value.length) ? value : folderName));
    const [directoryIndex, setDirectoryIndex] = useState([]);
    const [filteredIndex, setFilteredIndex] = useState([]);
    const onChangeSearch = (query) => {
        if (query) {
            query = query.toLowerCase();
            setFilteredIndex(directoryIndex.filter((card) => card.search.includes(query)));
        }
        else {
            setFilteredIndex(directoryIndex);
        }
    };
    useEffect(() => {
        // we don't want to load everything before picking a folder
        const folder = currentFolder === null || currentFolder === void 0 ? void 0 : currentFolder.value;
        if (folder) {
            const filter = mediaType === MediaType.Icon
                ? (item) => item.name.endsWith('.svg')
                : (item) => item.name.endsWith('.png') || item.name.endsWith('.gif');
            getDatasourceSrv()
                .get('-- Grafana --')
                .then((ds) => {
                ds.listFiles(folder).subscribe({
                    next: (frame) => {
                        const cards = [];
                        frame.forEach((item) => {
                            if (filter(item)) {
                                const idx = item.name.lastIndexOf('.');
                                cards.push({
                                    value: `${folder}/${item.name}`,
                                    label: item.name,
                                    search: (idx ? item.name.substring(0, idx) : item.name).toLowerCase(),
                                    imgUrl: `public/${folder}/${item.name}`,
                                });
                            }
                        });
                        setDirectoryIndex(cards);
                        setFilteredIndex(cards);
                    },
                });
            });
        }
    }, [mediaType, currentFolder]);
    return (React.createElement(React.Fragment, null,
        React.createElement(Field, null,
            React.createElement(Select, { options: folders, onChange: setCurrentFolder, value: currentFolder, menuShouldPortal: false })),
        React.createElement(Field, null,
            React.createElement(FilterInput, { value: searchQuery !== null && searchQuery !== void 0 ? searchQuery : '', placeholder: "Search", onChange: (v) => {
                    onChangeSearch(v);
                    setSearchQuery(v);
                } })),
        filteredIndex && (React.createElement("div", { className: styles.cardsWrapper },
            React.createElement(ResourceCards, { cards: filteredIndex, onChange: (v) => setNewValue(v), value: newValue })))));
};
const getStyles = (theme) => ({
    cardsWrapper: css `
    height: 30vh;
    min-height: 50px;
    margin-top: 5px;
    max-width: 680px;
  `,
});
//# sourceMappingURL=FolderPickerTab.js.map