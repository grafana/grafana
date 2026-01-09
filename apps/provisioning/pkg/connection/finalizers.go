package connection

// BlockDeletionFinalizer prevents deletion of connections while repositories reference them
const BlockDeletionFinalizer = "block-deletion-while-repositories-exist"
