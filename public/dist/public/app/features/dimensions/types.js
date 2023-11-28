import { TextDimensionMode } from '@grafana/schema';
export const defaultTextConfig = Object.freeze({
    fixed: '',
    mode: TextDimensionMode.Field,
    field: '',
});
export var ResourceFolderName;
(function (ResourceFolderName) {
    ResourceFolderName["Icon"] = "img/icons/unicons";
    ResourceFolderName["IOT"] = "img/icons/iot";
    ResourceFolderName["Marker"] = "img/icons/marker";
    ResourceFolderName["BG"] = "img/bg";
})(ResourceFolderName || (ResourceFolderName = {}));
export var MediaType;
(function (MediaType) {
    MediaType["Icon"] = "icon";
    MediaType["Image"] = "image";
})(MediaType || (MediaType = {}));
export var PickerTabType;
(function (PickerTabType) {
    PickerTabType["Folder"] = "folder";
    PickerTabType["URL"] = "url";
    PickerTabType["Upload"] = "upload";
})(PickerTabType || (PickerTabType = {}));
export var ResourcePickerSize;
(function (ResourcePickerSize) {
    ResourcePickerSize["SMALL"] = "small";
    ResourcePickerSize["NORMAL"] = "normal";
})(ResourcePickerSize || (ResourcePickerSize = {}));
//# sourceMappingURL=types.js.map