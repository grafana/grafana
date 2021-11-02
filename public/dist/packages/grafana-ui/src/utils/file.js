/**
 * Shortens the filename to 16 length
 * @param fileName
 */
export function trimFileName(fileName) {
    var nameLength = 16;
    var delimiter = fileName.lastIndexOf('.');
    var extension = fileName.substring(delimiter);
    var file = fileName.substring(0, delimiter);
    if (file.length < nameLength) {
        return fileName;
    }
    return file.substring(0, nameLength) + "..." + extension;
}
//# sourceMappingURL=file.js.map